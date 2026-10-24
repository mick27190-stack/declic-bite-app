import { listEmailLogs } from 'npm:@lovable.dev/email-js@0.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { legacyRejection, verificationOutcome } from '../_shared/verificationDeliveryOutcomes.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Separate delivery-outcome observer: no queue RPC, retry counter, or send.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!url || !key || !apiKey) return json({ error: 'Server configuration error' }, 500);
  const admin = createClient(url, key);
  const { data: secret, error: secretError } = await admin.from('app_config').select('value').eq('key', 'send_push_secret').single();
  if (secretError || !secret?.value || req.headers.get('x-webhook-secret') !== secret.value) return json({ error: 'Unauthorized' }, 401);

  try {
    const { data: state, error: stateError } = await admin.from('verification_delivery_monitor_state').select('checked_until').eq('id', 1).single();
    if (stateError) throw stateError;
    const until = new Date().toISOString();
    // Overlap handles eventual consistency; per-outcome dedupe prevents repeat alerts.
    const since = new Date(new Date(state?.checked_until ?? until).getTime() - 5 * 60_000).toISOString();
    const outcomes = [];
    for (const tag of ['signup', 'email_change']) {
      let cursor: string | undefined;
      do {
        const page = await listEmailLogs({ tag, since, until, limit: 100, cursor }, { apiKey });
        for (const event of page.data) {
          const outcome = verificationOutcome({ ...event, tags: [...(event.tags ?? []), tag] });
          if (outcome) outcomes.push(outcome);
        }
        cursor = page.pagination.has_more ? page.pagination.next_cursor ?? undefined : undefined;
      } while (cursor);
    }
    // Compatibility while the current sender is live. After the email update,
    // rejections come from listEmailLogs above; this branch simply becomes idle.
    let offset = 0;
    while (true) {
      const { data, error } = await admin.from('email_send_log')
        .select('message_id, template_name, recipient_email, status, created_at, error_message')
        .in('template_name', ['signup', 'email_change']).eq('status', 'dlq')
        .gte('created_at', since).lte('created_at', until).order('created_at').range(offset, offset + 499);
      if (error) throw error;
      for (const row of data ?? []) { const outcome = legacyRejection(row); if (outcome) outcomes.push(outcome); }
      if ((data?.length ?? 0) < 500) break;
      offset += 500;
    }
    let recorded = 0;
    for (const outcome of outcomes) {
      const { data, error } = await admin.rpc('record_verification_delivery_outcome', { outcome });
      if (error) throw error;
      if (data) recorded++;
    }
    const { error: updateError } = await admin.from('verification_delivery_monitor_state').update({ checked_until: until }).eq('id', 1);
    if (updateError) throw updateError;
    return json({ recorded });
  } catch (error) {
    console.error('Verification delivery monitor failed', { message: error instanceof Error ? error.message : 'Database or delivery history unavailable' });
    return json({ error: 'Delivery monitoring failed' }, 500);
  }
});