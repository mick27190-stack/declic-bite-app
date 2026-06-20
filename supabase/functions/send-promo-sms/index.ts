import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

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

    const { data: isAdmin } = await userClient.rpc('is_any_admin', { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: 'Accès refusé' }, 403);

    const { message, sites } = await req.json();
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1600) {
      return json({ error: 'Message invalide' }, 400);
    }
    const siteList: string[] = Array.isArray(sites) ? sites : [];

    // Gather recipients from the customer file (service role to read all customers)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let query = admin.from('customers').select('phone, site').not('phone', 'is', null);
    if (siteList.length > 0) {
      // include customers matching a selected site OR with no site assigned
      query = query.or(`site.in.(${siteList.join(',')}),site.is.null`);
    }
    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) return json({ error: 'Erreur lecture fichier client' }, 500);

    const phones = Array.from(
      new Set((rows || []).map((r: { phone: string | null }) => r.phone?.trim()).filter(Boolean)),
    ) as string[];

    if (phones.length === 0) {
      return json({ error: 'Aucun client avec numéro de téléphone' }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_FROM) {
      return json({
        error: 'sms_not_configured',
        message: 'La messagerie SMS n\'est pas encore configurée.',
        recipientCount: phones.length,
      }, 200);
    }

    let sent = 0;
    const failed: string[] = [];
    for (const to of phones) {
      const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message }),
      });
      if (resp.ok) sent++;
      else failed.push(to);
    }

    return json({ success: true, recipientCount: phones.length, sent, failed: failed.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
