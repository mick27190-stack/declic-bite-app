import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { stripeEventToOrderUpdate } from '../_shared/stripeEventMap.ts';

/**
 * Table de correspondance webhook Stripe → statuts de commande.
 * Ces règles conditionnent ce que le back-office affiche : toute régression ici
 * rend les statuts admin incohérents avec Stripe.
 */

const ORDER_ID = '11111111-2222-4333-8444-555555555555';

function piEvent(type: string, extra: Record<string, unknown> = {}) {
  return {
    type,
    data: { object: { id: 'pi_test_123', metadata: { order_id: ORDER_ID }, ...extra } },
  };
}

function chargeEvent(captured: boolean) {
  return {
    type: 'charge.succeeded',
    data: {
      object: {
        id: 'ch_test_123',
        payment_intent: 'pi_test_123',
        captured,
        metadata: { order_id: ORDER_ID },
      },
    },
  };
}

Deno.test('payment_intent.amount_capturable_updated → autorisé', () => {
  const r = stripeEventToOrderUpdate(piEvent('payment_intent.amount_capturable_updated'));
  assertEquals(r.paymentIntentId, 'pi_test_123');
  assertEquals(r.orderId, ORDER_ID);
  assertEquals(r.update, { capture_status: 'authorized' });
});

Deno.test('payment_intent.succeeded → encaissé et confirmé', () => {
  const r = stripeEventToOrderUpdate(piEvent('payment_intent.succeeded'));
  assertEquals(r.update, { capture_status: 'captured', order_status: 'confirmed' });
});

Deno.test('charge.succeeded non capturée → simple autorisation', () => {
  const r = stripeEventToOrderUpdate(chargeEvent(false));
  assertEquals(r.paymentIntentId, 'pi_test_123');
  assertEquals(r.update, { capture_status: 'authorized' });
});

Deno.test('charge.succeeded capturée → encaissé et confirmé', () => {
  const r = stripeEventToOrderUpdate(chargeEvent(true));
  assertEquals(r.update, { capture_status: 'captured', order_status: 'confirmed' });
});

Deno.test('payment_intent.canceled → commande annulée', () => {
  const r = stripeEventToOrderUpdate(piEvent('payment_intent.canceled'));
  assertEquals(r.update, {
    capture_status: 'cancelled',
    order_status: 'cancelled',
    status: 'cancelled',
  });
});

Deno.test('payment_intent.payment_failed → commande annulée sans capture', () => {
  const r = stripeEventToOrderUpdate(piEvent('payment_intent.payment_failed'));
  assertEquals(r.update, { order_status: 'cancelled', status: 'cancelled' });
});

Deno.test('événement non géré → ignoré', () => {
  const r = stripeEventToOrderUpdate(piEvent('payment_intent.created'));
  assertEquals(r.update, null);
});

Deno.test('événement sans PaymentIntent → ignoré', () => {
  const r = stripeEventToOrderUpdate({
    type: 'charge.succeeded',
    data: { object: { id: 'ch_orphan' } },
  });
  assertEquals(r.paymentIntentId, undefined);
});
