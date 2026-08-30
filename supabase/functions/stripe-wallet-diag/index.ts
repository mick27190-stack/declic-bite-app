import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { listPaymentMethodDomains, type StripeSite } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const out: Record<string, unknown> = {};
  for (const site of ['conches', 'beaumont'] as StripeSite[]) {
    try {
      const list = await listPaymentMethodDomains(site);
      out[site] = ((list.data as Record<string, unknown>[]) ?? []).map((d) => ({
        domain: d.domain_name,
        enabled: d.enabled,
        apple: (d.apple_pay as Record<string, unknown>)?.status,
        apple_err: ((d.apple_pay as Record<string, unknown>)?.status_details as Record<string, unknown>)?.error_message,
        google: (d.google_pay as Record<string, unknown>)?.status,
        google_err: ((d.google_pay as Record<string, unknown>)?.status_details as Record<string, unknown>)?.error_message,
      }));
    } catch (e) { out[site] = { error: (e as Error).message }; }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
