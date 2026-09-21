import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const url = new URL(req.url);
  let token: string | null = url.searchParams.get('token');

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body?.token) token = body.token;
    } catch {
      // token reste celui du query param
    }
  }

  if (!token) return jsonResponse({ error: 'Token is required' }, 400);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: tokenRecord, error: lookupError } = await supabase
    .from('sms_unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (lookupError || !tokenRecord) {
    return jsonResponse({ error: 'Invalid or expired token' }, 404);
  }

  if (tokenRecord.used_at) {
    return jsonResponse({ valid: false, reason: 'already_unsubscribed' });
  }

  if (req.method === 'GET') {
    return jsonResponse({ valid: true });
  }

  // Marquage atomique pour éviter un double traitement.
  const { data: updated, error: updateError } = await supabase
    .from('sms_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select()
    .maybeSingle();

  if (updateError) {
    console.error('Failed to mark sms token as used', { error: updateError });
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500);
  }
  if (!updated) {
    return jsonResponse({ success: false, reason: 'already_unsubscribed' });
  }

  // Compte client rattaché : par le token, sinon via la fiche client ou le
  // téléphone du profil, pour que le statut « Refusé » remonte partout.
  let clientId: string | null = tokenRecord.user_id ?? null;
  if (!clientId && tokenRecord.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('user_id')
      .eq('id', tokenRecord.customer_id)
      .maybeSingle();
    clientId = customer?.user_id ?? null;
  }
  if (!clientId && tokenRecord.phone) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('phone', tokenRecord.phone.trim())
      .maybeSingle();
    clientId = profile?.user_id ?? null;
  }

  if (clientId) {
    // Toujours une nouvelle ligne : l'historique de consentement n'est jamais modifié.
    const { error: consentError } = await supabase.from('consentements').insert({
      client_id: clientId,
      type_consentement: 'sms_marketing',
      accepte: false,
      version_document: LEGAL_DOCS_VERSION,
      motif_refus: 'Désinscription via lien SMS',
    });
    if (consentError) {
      console.error('Failed to insert sms consent', { error: consentError });
      return jsonResponse({ error: 'Failed to process unsubscribe' }, 500);
    }
  }

  // Opt-out au niveau du numéro dans tous les cas (clients sans compte inclus).
  const { error: optOutError } = await supabase
    .from('sms_opt_outs')
    .upsert({ phone: tokenRecord.phone.trim() }, { onConflict: 'phone' });
  if (optOutError) {
    console.error('Failed to insert sms opt-out', { error: optOutError });
    if (!clientId) return jsonResponse({ error: 'Failed to process unsubscribe' }, 500);
  }

  return jsonResponse({ success: true });
});
