import { expect, test, type Page } from "@playwright/test";
import { mockBackend, installFakeSession, TEST_USER_ID, type BackendRecorder } from "./helpers/mockBackend";

/**
 * E2E — Back-office commandes : capture, annulation et changements de statut
 *
 * Règles vérifiées :
 *   1. Passage au statut « Confirmée » → capture Stripe (`confirm-order`)
 *      AVANT la mise à jour du statut en base.
 *   2. Passage au statut « Annulée » → libération de la pré-autorisation
 *      (`cancel-order`) sans PATCH direct du statut.
 *   3. Si la capture échoue, le statut n'est PAS modifié en base.
 *   4. Contre-proposition d'horaire livraison : confirmation / refus au nom du
 *      client via `respond-to-delivery-time`.
 *
 * Backend, auth et rôles sont simulés (voir helpers/mockBackend).
 */

const CONCHES = "Déclic Pizza Conches";

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-2222-4333-8444-555555555555",
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
    order_status: null,
    stripe_payment_intent_id: "pi_e2e_123",
    capture_status: "authorized",
    ...overrides,
  };
}

async function openAdminOrders(
  page: Page,
  base: string,
  orders: Record<string, unknown>[],
  functions: Record<string, { status?: number; body: Record<string, unknown> }> = {},
): Promise<BackendRecorder> {
  const recorder = await mockBackend(page, {
    roles: ["super_admin"],
    tables: {
      orders,
      order_history: [],
      profiles: [
        {
          user_id: TEST_USER_ID,
          first_name: "Jean",
          last_name: "Client",
          phone: "+33600000000",
        },
      ],
      notifications: [],
      company_info: [],
      restaurant_closures: [],
      admin_phones: [],
    },
    functions: {
      "assign-admin-role": { body: { success: true } },
      "confirm-order": { body: { success: true, capture_status: "captured" } },
      "cancel-order": { body: { success: true, capture_status: "cancelled" } },
      "respond-to-delivery-time": { body: { success: true } },
      ...functions,
    },
  });

  await installFakeSession(page, base);
  await page.goto(`${base}/admin/orders`);
  await expect(page.getByText("#11111111").first()).toBeVisible();
  return recorder;
}

/** Change le statut via le sélecteur de la carte commande. */
async function selectStatus(page: Page, label: RegExp) {
  await page.locator('button[role="combobox"]').last().click();
  await page.getByRole("option", { name: label }).click();
}

test.describe("Back-office — statuts et Stripe (à emporter)", () => {
  test("« Confirmée » capture le paiement puis met à jour le statut", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [baseOrder()]);

    await selectStatus(page, /^Confirmée$/);

    await expect.poll(() => recorder.countCalls("confirm-order")).toBe(1);
    expect(recorder.lastCall("confirm-order")?.body.order_id).toBe(baseOrder().id);

    // Le statut n'est patché qu'après une capture réussie.
    await expect
      .poll(() => recorder.orderWrites.filter((w) => w.method === "PATCH").length)
      .toBe(1);
    expect(recorder.orderWrites.at(-1)?.body).toMatchObject({ status: "confirmed" });
  });

  test("si la capture échoue, le statut n'est pas modifié", async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [baseOrder()], {
      "confirm-order": { body: { error: "Pré-autorisation expirée" } },
    });

    await selectStatus(page, /^Confirmée$/);

    await expect.poll(() => recorder.countCalls("confirm-order")).toBe(1);
    await expect(page.getByText(/Pré-autorisation expirée/i).first()).toBeVisible();
    expect(recorder.orderWrites.filter((w) => w.method === "PATCH")).toHaveLength(0);
  });

  test("« Annulée » libère la pré-autorisation Stripe", async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [baseOrder()]);

    await selectStatus(page, /^Annulée$/);

    await expect.poll(() => recorder.countCalls("cancel-order")).toBe(1);
    expect(recorder.lastCall("cancel-order")?.body.order_id).toBe(baseOrder().id);
    expect(recorder.countCalls("confirm-order")).toBe(0);
    expect(recorder.orderWrites.filter((w) => w.method === "PATCH")).toHaveLength(0);
  });
});

test.describe("Back-office — livraison et contre-proposition d'horaire", () => {
  const deliveryOrder = baseOrder({
    order_type: "livraison",
    delivery_address: {
      address: "12 Rue de la Paix, 27190 Conches-en-Ouche",
      coordinates: { lat: 48.96, lng: 0.94 },
      city: "Conches-en-Ouche",
      postalCode: "27190",
    },
    order_status: "awaiting_customer_response",
    delivery_time_proposed: "2026-08-11T18:45:00.000Z",
  });

  test("affiche l'attente de réponse client avec le téléphone joignable", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await openAdminOrders(page, base, [deliveryOrder]);

    await expect(page.getByText(/En attente de réponse du client/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /\+33600000000/ })).toBeVisible();
  });

  test("« Confirmer au nom du client » déclenche la capture via respond-to-delivery-time", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [deliveryOrder]);

    await page.getByRole("button", { name: /confirmer au nom du client/i }).click();

    await expect.poll(() => recorder.countCalls("respond-to-delivery-time")).toBe(1);
    expect(recorder.lastCall("respond-to-delivery-time")?.body).toMatchObject({
      order_id: deliveryOrder.id,
      response: "accepted",
    });
    await expect(page.getByText(/Horaire confirmé/i).first()).toBeVisible();
  });

  test("« Refuser au nom du client » annule la pré-autorisation", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [deliveryOrder]);

    await page.getByRole("button", { name: /refuser au nom du client/i }).click();

    await expect.poll(() => recorder.countCalls("respond-to-delivery-time")).toBe(1);
    expect(recorder.lastCall("respond-to-delivery-time")?.body).toMatchObject({
      order_id: deliveryOrder.id,
      response: "refused",
    });
    await expect(page.getByText(/Horaire refusé/i).first()).toBeVisible();
  });

  test("« Livrée » capture aussi le paiement pour une commande en livraison", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await openAdminOrders(page, base, [
      baseOrder({
        order_type: "livraison",
        status: "ready",
        delivery_address: {
          address: "12 Rue de la Paix",
          coordinates: { lat: 48.96, lng: 0.94 },
          city: "Conches-en-Ouche",
        },
      }),
    ]);

    await selectStatus(page, /^Livrée$/);

    await expect.poll(() => recorder.countCalls("confirm-order")).toBe(1);
    await expect
      .poll(() => recorder.orderWrites.filter((w) => w.method === "PATCH").length)
      .toBe(1);
    expect(recorder.orderWrites.at(-1)?.body).toMatchObject({ status: "delivered" });
  });
});
