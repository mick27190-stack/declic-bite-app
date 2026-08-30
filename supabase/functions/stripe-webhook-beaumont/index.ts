import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { handleStripeWebhook } from '../_shared/stripeWebhook.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return handleStripeWebhook(req, 'beaumont');
});
