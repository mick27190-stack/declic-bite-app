import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createPaymentIntent, resolveSite } from '../_shared/stripe.ts';
import { requireUser, serviceClient } from '../_shared/orderAccess.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id ?? '');
    if (!orderId) throw new Error('order_id requis');

    const sb = serviceClient();
    const { data: order, error } = await sb
      .from('orders')
      .select('id, user_id, restaurant, order_type, total_price, site, stripe_payment_intent_id')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Commande introuvable');
    if (order.user_id !== userId) throw new Error('Cette commande ne vous appartient pas');
    if (order.stripe_payment_intent_id) {
      // Idempotent : renvoyer le PaymentIntent existant
      const { retrievePaymentIntent } = await import('../_shared/stripe.ts');
      const pi = await retrievePaymentIntent(resolveSite(order.site), order.stripe_payment_intent_id);
      return new Response(
        JSON.stringify({ client_secret: pi.client_secret, payment_intent_id: pi.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const site = resolveSite(order.site ?? order.restaurant);
    const amountCents = Math.round(Number(order.total_price) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Montant invalide');

    const pi = await createPaymentIntent(site, {
      amountCents,
      orderId: order.id,
      orderType: order.order_type,
    });

    const { error: updateError } = await sb
      .from('orders')
      .update({
        stripe_payment_intent_id: pi.id as string,
        order_status: 'pending_confirmation',
        // L'autorisation n'est confirmée que via le webhook
        // (payment_intent.amount_capturable_updated) -> 'authorized'
        capture_status: 'pending',
        site,
        delivery_time_requested: order.order_type === 'livraison' ? new Date().toISOString() : null,
      })
      .eq('id', order.id)
      .is('stripe_payment_intent_id', null);

    if (updateError) {
      // Sans ce lien, le webhook Stripe ne pourra jamais retrouver la commande.
      console.error('Impossible de lier le PaymentIntent à la commande:', updateError.message);
      throw new Error("Impossible d'enregistrer le paiement sur la commande");
    }


    return new Response(
      JSON.stringify({ client_secret: pi.client_secret, payment_intent_id: pi.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
