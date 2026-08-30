import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolveSite, stripePublicKey } from '../_shared/stripe.ts';

// Renvoie la clé publique (pk_live) du compte Stripe correspondant au site.
// Les clés pk_ sont publiques par conception ; les clés rk_live restent côté serveur.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const site = resolveSite(url.searchParams.get('site'));
    return new Response(JSON.stringify({ publishable_key: stripePublicKey(site), site }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
