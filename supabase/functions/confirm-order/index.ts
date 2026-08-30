import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { capturePaymentIntent, resolveSite } from '../_shared/stripe.ts';
import { requireAdminForSite, serviceClient } from '../_shared/orderAccess.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    if (!orderId) throw new Error('order_id requis');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, restaurant, site, stripe_payment_intent_id, capture_status, order_status')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');

    const site = resolveSite(order.site ?? order.restaurant);
    await requireAdminForSite(req, site);

    if (!order.stripe_payment_intent_id) throw new Error('Aucun paiement associé à cette commande');
    if (order.capture_status === 'captured') {
      return new Response(JSON.stringify({ ok: true, already_captured: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await capturePaymentIntent(site, order.stripe_payment_intent_id);

    await sb
      .from('orders')
      .update({
        order_status: 'confirmed',
        capture_status: 'captured',
        status: 'confirmed',
      })
      .eq('id', order.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
