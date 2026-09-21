import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';
const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://declicpizza.fr';

/** Heure murale de Paris (mêmes conventions que src/lib/parisTime.ts). */
function parisCivilDate(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
    0,
  );
}

/** Dimanche de Pâques (algorithme de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function frenchHolidays(year: number): Set<string> {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const easter = easterSunday(year);
  const plus = (days: number) => {
    const d = new Date(easter);
    d.setDate(d.getDate() + days);
    return d;
  };
  return new Set([
    `${year}-01-01`,
    iso(plus(1)), // lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    iso(plus(39)), // Ascension
    iso(plus(50)), // lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

/** Créneau légal d'envoi : 8h–20h, hors dimanche et jours fériés. */
function checkSendWindow(now = new Date()): string | null {
  const paris = parisCivilDate(now);
  if (paris.getDay() === 0) {
    return "Envoi interdit le dimanche. Réessayez un jour ouvré entre 8h et 20h.";
  }
  const isoDay = `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, '0')}-${String(paris.getDate()).padStart(2, '0')}`;
  if (frenchHolidays(paris.getFullYear()).has(isoDay)) {
    return "Envoi interdit un jour férié. Réessayez un jour ouvré entre 8h et 20h.";
  }
  const hour = paris.getHours();
  if (hour < 8 || hour >= 20) {
    return "Envoi possible uniquement entre 8h et 20h (heure de Paris).";
  }
  return null;
}

/**
 * Twilio exige le format E.164 (+33...). Le fichier client stocke les numéros
 * sans le « + » (ex. 33612345678) : sans normalisation, chaque envoi échoue.
 */
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `33${digits.slice(1)}`;
  else if (digits.length === 9) digits = `33${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Non autorisé' }, 401);

    // Verify the caller is an authenticated admin
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Non autorisé' }, 401);

    // Envoi de SMS promotionnels réservé au Super Admin et aux Super Admins secondaires.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const isSuperAdmin = (roles || []).some(
      (r) => r.role === 'super_admin' || r.role === 'secondary_super_admin',
    );
    if (!isSuperAdmin) return json({ error: 'Accès refusé' }, 403);

    const { message, sites } = await req.json();
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1600) {
      return json({ error: 'Message invalide' }, 400);
    }

    // Contrainte légale d'envoi (heure de Paris) : 8h–20h, hors dimanche et fériés.
    const windowError = checkSendWindow();
    if (windowError) {
      return json({ error: 'send_window', message: windowError }, 400);
    }

    const ALLOWED_SITES = ['conches', 'beaumont'];
    const siteList: string[] = (Array.isArray(sites) ? sites : []).filter(
      (s: unknown): s is string => typeof s === 'string' && ALLOWED_SITES.includes(s),
    );

    // Gather recipients from the customer file, excluding anyone whose most
    // recent SMS marketing consent is a refusal (opt-out takes effect at once,
    // and re-enabling the toggle puts the customer back in the list).
    const { data: rows, error: rowsErr } = await admin.rpc('sms_marketing_recipients_v2', {
      _sites: siteList.length > 0 ? siteList : null,
    });
    if (rowsErr) return json({ error: 'Erreur lecture fichier client' }, 500);

    type Recipient = { phone: string; customer_id: string | null; user_id: string | null };
    const byPhone = new Map<string, Recipient>();
    for (const r of (rows || []) as {
      phone: string | null;
      customer_id: string | null;
      user_id: string | null;
    }[]) {
      const phone = toE164(r.phone);
      if (!phone || byPhone.has(phone)) continue;
      byPhone.set(phone, { phone, customer_id: r.customer_id, user_id: r.user_id });
    }
    const recipients = Array.from(byPhone.values());

    if (recipients.length === 0) {
      return json({ error: 'Aucun client inscrit aux SMS promotionnels' }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');
    // Expéditeur de marque (DECLICPIZZA) via le Messaging Service Twilio.
    const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM)) {
      return json({
        error: 'sms_not_configured',
        message: 'La messagerie SMS n\'est pas encore configurée.',
        recipientCount: recipients.length,
      }, 200);
    }


    // Un token de désinscription par destinataire, créé au moment de l'envoi.
    const tokenRows = recipients.map((r) => ({
      customer_id: r.customer_id,
      user_id: r.user_id,
      phone: r.phone,
    }));
    const { data: tokens, error: tokenErr } = await admin
      .from('sms_unsubscribe_tokens')
      .insert(tokenRows)
      .select('token, phone');
    if (tokenErr) {
      console.error('Failed to create sms unsubscribe tokens', tokenErr);
      return json({ error: 'Erreur création des liens de désinscription' }, 500);
    }
    const tokenByPhone = new Map<string, string>();
    for (const t of (tokens || []) as { token: string; phone: string }[]) {
      if (!tokenByPhone.has(t.phone)) tokenByPhone.set(t.phone, t.token);
    }

    // Marge de sécurité : le message est tronqué pour que le lien "Stop" tienne.
    const MAX_BODY = 1500;

    let sent = 0;
    const failed: string[] = [];
    for (const r of recipients) {
      const token = tokenByPhone.get(r.phone);
      const stop = token
        ? ` Stop: ${PUBLIC_SITE_URL}/desabonnement-sms?token=${token}`
        : '';
      const base = message.length + stop.length > MAX_BODY
        ? message.slice(0, Math.max(0, MAX_BODY - stop.length))
        : message;
      const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(
          TWILIO_MESSAGING_SERVICE_SID
            ? { To: r.phone, MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID, Body: `${base}${stop}` }
            : { To: r.phone, From: TWILIO_FROM!, Body: `${base}${stop}` },
        ),
      });
      if (resp.ok) sent++;
      else {
        failed.push(r.phone);
        console.error(`Twilio send failed [${resp.status}]: ${await resp.text()}`);
      }
    }

    return json({ success: true, recipientCount: recipients.length, sent, failed: failed.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
