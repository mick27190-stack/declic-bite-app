import { expect, test, type Page } from "@playwright/test";
import { mockBackend, installFakeSession, TEST_USER_ID, type BackendRecorder } from "./helpers/mockBackend";
import { stripeEventToOrderUpdate } from "../supabase/functions/_shared/stripeWebhook";

/**
 * E2E — Cohérence back-office ↔ webhooks Stripe
 *
 * Les webhooks Stripe (`payment_intent.succeeded`, `charge.succeeded`,
 * `payment_intent.canceled`) sont rejoués localement via la même fonction pure
 * que l'Edge Function (`stripeEventToOrderUpdate`), appliquée à la commande
 * simulée. On recharge ensuite la page admin pour vérifier que le statut
 * affiché correspond exactement à l'état Stripe.
 */

const CONCHES = "Déclic Pizza Conches";
const ORDER_ID = "11111111-2222-4333-8444-555555555555";
const PI_ID = "pi_e2e_webhook";

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    user_id: TEST_USER_ID,
    restaurant: CONCHES,
    order_type: "emporter",
    items: [
      {
        pizza: { id: "margherita", name: "Margherita", category: "classiques" },
        size: { id: "senior", name: "Senior", price: 9 },
        supplements: [],
        quantity: 1,
      },
    ],
    status: "pending",
    total_price: 9,
    pickup_time: "20:00",
    delivery_address: null,
    notes: null,
    created_at: "2026-08-11T17:00:00.000Z",
    updated_at: "2026-08-11T17:00:00.000Z",
    delivery_estimate: null,
    delivery_response: null,
    site: "conches",
    order_status: "pending_confirmation",
    stripe_payment_intent_id: PI_ID,
    capture_status: "authorized",
    ...overrides,
  };
}

function piEvent(type: string, extra: Record<string, unknown> = {}) {
  return {
    type,
    data: { object: { id: PI_ID, metadata: { order_id: ORDER_ID }, ...extra } },
  };
}

function chargeEvent(captured: boolean) {
  return {
    type: "charge.succeeded",
    data: {
      object: {
        id: "ch_e2e",
        payment_intent: PI_ID,
        captured,
        metadata: { order_id: ORDER_ID },
      },
    },
  };
}

/** Applique un événement Stripe à la commande simulée, comme le ferait l'Edge Function. */
function deliverWebhook(orders: Record<string, unknown>[], event: Record<string, unknown>) {
  const { paymentIntentId, orderId, update } = stripeEventToOrderUpdate(event);
  expect(update, `événement ${event.type} non pris en charge`).not.toBeNull();
  const target = orders.find(
    (o) => o.stripe_payment_intent_id === paymentIntentId && (!orderId || o.id === orderId),
  );
  expect(target, "aucune commande ne correspond au PaymentIntent").toBeTruthy();
  Object.assign(target!, update, { updated_at: new Date().toISOString() });
}

async function openAdminOrders(
  page: Page,
  base: string,
  orders: Record<string, unknown>[],
): Promise<BackendRecorder> {
  const recorder = await mockBackend(page, {
    roles: ["super_admin"],
    tables: {
      orders,
      order_history: [],
      profiles: [
        { user_id: TEST_USER_ID, first_name: "Jean", last_name: "Client", phone: "+33600000000" },
      ],
      notifications: [],
      company_info: [],
      restaurant_closures: [],
      admin_phones: [],
    },
    functions: { "assign-admin-role": { body: { success: true } } },
  });

  await installFakeSession(page, base);
  await page.goto(`${base}/admin/orders`);
  return recorder;
}

test.describe("Webhooks Stripe — cohérence des statuts en back-office", () => {
  test("payment_intent.succeeded affiche la commande encaissée et confirmée", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const orders = [baseOrder()];
    await openAdminOrders(page, base, orders);
    await expect(page.getByText("#11111111").first()).toBeVisible();

    deliverWebhook(orders, piEvent("payment_intent.succeeded"));
    await page.reload();

    await expect(page.getByText("#11111111").first()).toBeVisible();
    expect(orders[0]).toMatchObject({
      capture_status: "captured",
      order_status: "confirmed",
    });
    await expect(page.getByText(/Paiement encaissé/i).first()).toBeVisible();
  });

  test("charge.succeeded non capturée laisse la commande en simple autorisation", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const orders = [baseOrder({ capture_status: "pending" })];
    await openAdminOrders(page, base, orders);

    // Tant que le paiement n'est pas autorisé, la commande reste masquée.
    await expect(page.getByText("#11111111")).toHaveCount(0);

    deliverWebhook(orders, chargeEvent(false));
    await page.reload();

    expect(orders[0]).toMatchObject({ capture_status: "authorized" });
    await expect(page.getByText("#11111111").first()).toBeVisible();
    await expect(page.getByText(/Paiement autorisé/i).first()).toBeVisible();
  });

  test("charge.succeeded capturée bascule la commande en encaissée", async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:8080";
    const orders = [baseOrder()];
    await openAdminOrders(page, base, orders);
    await expect(page.getByText("#11111111").first()).toBeVisible();

    deliverWebhook(orders, chargeEvent(true));
    await page.reload();

    expect(orders[0]).toMatchObject({
      capture_status: "captured",
      order_status: "confirmed",
    });
    await expect(page.getByText(/Paiement encaissé/i).first()).toBeVisible();
  });

  test("payment_intent.canceled retire la commande du back-office", async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:8080";
    const orders = [baseOrder()];
    await openAdminOrders(page, base, orders);
    await expect(page.getByText("#11111111").first()).toBeVisible();

    deliverWebhook(orders, piEvent("payment_intent.canceled"));
    await page.reload();

    expect(orders[0]).toMatchObject({
      capture_status: "cancelled",
      order_status: "cancelled",
      status: "cancelled",
    });
    // Autorisation libérée : la commande ne doit plus apparaître comme active.
    await expect(page.getByText("#11111111")).toHaveCount(0);
  });

  test("payment_intent.payment_failed annule la commande sans capture", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const orders = [baseOrder()];
    await openAdminOrders(page, base, orders);
    await expect(page.getByText("#11111111").first()).toBeVisible();

    deliverWebhook(orders, piEvent("payment_intent.payment_failed"));
    await page.reload();

    expect(orders[0]).toMatchObject({ order_status: "cancelled", status: "cancelled" });
    await expect(page.getByText(/Annulée/i).first()).toBeVisible();
  });
});
