import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { verifyStripeSignature, type StripeSite } from './stripe.ts';
import { serviceClient } from './orderAccess.ts';

/**
 * Traitement partagé des webhooks Stripe des deux comptes.
 * Chaque endpoint (conches/beaumont) vérifie la signature avec son propre secret,
 * puis délègue ici.
 */
export async function handleStripeWebhook(req: Request, site: StripeSite): Promise<Response> {
  const secret = Deno.env.get(
    site === 'beaumont' ? 'STRIPE_WEBHOOK_SECRET_BEAUMONT' : 'STRIPE_WEBHOOK_SECRET_CONCHES',
  );
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Webhook secret non configuré' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: Record<string, unknown>;
  try {
    const rawBody = await req.text();
    event = await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resolved = stripeEventToOrderUpdate(event);
  const { paymentIntentId, orderId, update } = resolved;

  if (!paymentIntentId) {
    return new Response(JSON.stringify({ received: true, ignored: 'no payment intent id' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!update) {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sb = serviceClient();


  let query = sb.from('orders').update(update).eq('stripe_payment_intent_id', paymentIntentId);
  if (orderId) query = query.eq('id', orderId);
  const { error } = await query;
  if (error) console.error('Webhook order update failed:', error.message);

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
