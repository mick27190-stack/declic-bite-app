import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { cancelPaymentIntent, resolveSite } from '../_shared/stripe.ts';
import { requireAdminForSite, requireUser, serviceClient } from '../_shared/orderAccess.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    if (!orderId) throw new Error('order_id requis');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, user_id, restaurant, site, order_status, stripe_payment_intent_id, capture_status')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');

    const site = resolveSite(order.site ?? order.restaurant);
    // Admin du site, ou le client lui-même tant que le paiement n'est pas capturé
    // et que la pizzeria n'a pas encore confirmé la commande.
    const userId = await requireUser(req);
    const ownerMayCancel =
      order.user_id === userId &&
      order.capture_status !== 'captured' &&
      (order.order_status === null || order.order_status === 'pending_confirmation');
    if (!ownerMayCancel) await requireAdminForSite(req, site);


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
