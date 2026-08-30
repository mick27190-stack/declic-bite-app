import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { cancelPaymentIntent, resolveSite } from '../_shared/stripe.ts';
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
      .select('id, restaurant, site, stripe_payment_intent_id, capture_status')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');

    const site = resolveSite(order.site ?? order.restaurant);
    await requireAdminForSite(req, site);

    // Annule le PaymentIntent seulement s'il n'a jamais été capturé
    if (order.stripe_payment_intent_id && order.capture_status !== 'captured') {
      try {
        await cancelPaymentIntent(site, order.stripe_payment_intent_id);
      } catch (e) {
        console.error('Stripe cancel failed (continuing):', (e as Error).message);
      }
    }

    await sb
      .from('orders')
      .update({
        order_status: 'cancelled',
        capture_status: order.capture_status === 'captured' ? 'captured' : 'cancelled',
        status: 'cancelled',
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
