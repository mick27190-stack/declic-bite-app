import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { verifyStripeSignature, type StripeSite } from './stripe.ts';
import { serviceClient } from './orderAccess.ts';

export interface ResolvedStripeEvent {
  paymentIntentId?: string;
  orderId?: string;
  /** `null` = événement ignoré (aucune mise à jour de commande). */
  update: Record<string, unknown> | null;
}

/**
 * Traduit un événement Stripe en mise à jour de commande.
 * Fonction pure (testable sans réseau ni base) : la cohérence des statuts
 * affichés en back-office dépend entièrement de cette table de correspondance.
 */
export function stripeEventToOrderUpdate(event: Record<string, unknown>): ResolvedStripeEvent {
  const type = event.type as string;
  const object = (event.data as { object?: Record<string, unknown> })?.object ?? {};
  const metadata = object.metadata as Record<string, string> | undefined;
  const isCharge = typeof type === 'string' && type.startsWith('charge.');
  const paymentIntentId = isCharge
    ? (object.payment_intent as string | undefined)
    : (object.id as string | undefined);
  const orderId = metadata?.order_id;

  let update: Record<string, unknown> | null = null;
  switch (type) {
    case 'payment_intent.amount_capturable_updated':
      update = { capture_status: 'authorized' };
      break;
    case 'payment_intent.succeeded':
      // Paiement encaissé : la commande est forcément confirmée côté pizzeria.
      update = { capture_status: 'captured', order_status: 'confirmed' };
      break;
    case 'charge.succeeded':
      // Charge simplement autorisée (capture manuelle) vs réellement encaissée.
      update = object.captured === true
        ? { capture_status: 'captured', order_status: 'confirmed' }
        : { capture_status: 'authorized' };
      break;
    case 'payment_intent.canceled':
      update = { capture_status: 'cancelled', order_status: 'cancelled', status: 'cancelled' };
      break;
    case 'payment_intent.payment_failed':
      update = { order_status: 'cancelled', status: 'cancelled' };
      break;
    default:
      update = null;
  }

  return { paymentIntentId, orderId, update };
}

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
