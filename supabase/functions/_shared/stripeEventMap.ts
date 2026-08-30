/**
 * Correspondance pure entre événements Stripe et mises à jour de commande.
 * Aucun import Deno/Supabase ici : ce module est partagé par les Edge Functions
 * et par les tests E2E Playwright.
 */

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

