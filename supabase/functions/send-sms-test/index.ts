import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';
const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://declicpizza.fr';

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

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Non autorisé' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const isSuperAdmin = (roles || []).some(
      (r) => r.role === 'super_admin' || r.role === 'secondary_super_admin',
    );
    if (!isSuperAdmin) return json({ error: 'Accès refusé' }, 403);

    const { message, phone } = await req.json();
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1600) {
      return json({ error: 'Message invalide' }, 400);
    }
    if (typeof phone !== 'string' || !/^\+\d{8,15}$/.test(phone.trim())) {
      return json({ error: 'Numéro de test invalide' }, 400);
    }
    const to = phone.trim();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');
    // Expéditeur de marque (DECLICPIZZA) via le Messaging Service Twilio.
    const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM)) {
      return json({
        error: 'sms_not_configured',
        message: "La messagerie SMS n'est pas encore configurée.",
      }, 200);
    }

    // Le SMS test doit être identique à un envoi réel : lien « Stop » inclus.
    let stop = '';
    const { data: tokenRow, error: tokenErr } = await admin
      .from('sms_unsubscribe_tokens')
      .insert({ phone: to, user_id: null, customer_id: null })
      .select('token')
      .maybeSingle();
    if (tokenErr) console.error('Failed to create test unsubscribe token', tokenErr);
    else if (tokenRow?.token) {
      stop = ` Stop: ${PUBLIC_SITE_URL}/desabonnement-sms?token=${tokenRow.token}`;
    }
    const body = `[TEST] ${message}${stop}`;

    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TWILIO_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(
        TWILIO_MESSAGING_SERVICE_SID
          ? { To: to, MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID, Body: `[TEST] ${message}` }
          : { To: to, From: TWILIO_FROM!, Body: `[TEST] ${message}` },
      ),
    });

    if (!resp.ok) {
      const details = await resp.text();
      console.error(`Twilio test send failed [${resp.status}]: ${details}`);
      return json({ error: 'Envoi du SMS test impossible', status: resp.status, details }, resp.status);
    }

    return json({ success: true, to });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
