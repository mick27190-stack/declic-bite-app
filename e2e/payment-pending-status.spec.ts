import { expect, test, type Page } from "@playwright/test";
import { mockBackend, installFakeSession, TEST_USER_ID, type BackendRecorder } from "./helpers/mockBackend";

/**
 * E2E — Après paiement, la commande arrive toujours au statut « En attente »
 * dans la gestion des commandes du back-office admin.
 *
 * Règles vérifiées :
 *   1. Côté client : la commande est créée en base avec le statut « pending »
 *      (En attente) au moment du paiement — jamais un autre statut.
 *   2. Côté admin : une commande payée (pré-autorisation Stripe « authorized »)
 *      est affichée avec le statut « En attente ».
 *   3. Côté admin : une commande dont le paiement n'est pas autorisé
 *      (panier abandonné / paiement échoué) n'apparaît PAS dans la liste.
 *
 * Backend, auth et Stripe sont entièrement simulés (voir helpers/mockBackend).
 */

const CONCHES = "Déclic Pizza Conches";
const PAID_ORDER_ID = "11111111-2222-4333-8444-555555555555";
const UNPAID_ORDER_ID = "22222222-3333-4333-8444-666666666666";
const CART_STORAGE_KEY = "declic-cart-state";
const IN_SERVICE_UTC = "2026-08-11T17:00:00.000Z"; // mardi 11/08/2026, 19h00 Paris

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: PAID_ORDER_ID,
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
    stripe_payment_intent_id: "pi_e2e_paid",
    capture_status: "authorized",
    ...overrides,
  };
}

async function openAdminOrders(page: Page, base: string, orders: Record<string, unknown>[]) {
  await mockBackend(page, {
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
    functions: { "assign-admin-role": { body: { success: true } } },
  });
  await installFakeSession(page, base);
  await page.goto(`${base}/admin/orders`);
}

test.describe("Back-office — statut « En attente » après paiement", () => {
  test("une commande payée s'affiche au statut « En attente » dans la liste admin", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await openAdminOrders(page, base, [orderFixture()]);

    // La commande est visible…
    await expect(page.getByText(`#${PAID_ORDER_ID.slice(0, 8)}`).first()).toBeVisible();
    // …et son sélecteur de statut affiche « En attente » (pas Confirmée ni autre).
    await expect(page.locator('button[role="combobox"]').last()).toContainText("En attente");
  });

  test("une commande dont le paiement n'est pas autorisé n'apparaît pas en admin", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await openAdminOrders(page, base, [
      orderFixture(),
      orderFixture({
        id: UNPAID_ORDER_ID,
        stripe_payment_intent_id: "pi_e2e_unpaid",
        capture_status: "pending", // paiement jamais autorisé
      }),
    ]);

    // Seule la commande payée remonte : la non payée est filtrée.
    await expect(page.getByText(`#${PAID_ORDER_ID.slice(0, 8)}`).first()).toBeVisible();
    await expect(page.getByText(`#${UNPAID_ORDER_ID.slice(0, 8)}`)).toHaveCount(0);
  });

  test("un panier abandonné sans paiement n'apparaît pas en admin", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await openAdminOrders(page, base, [
      orderFixture({
        id: UNPAID_ORDER_ID,
        stripe_payment_intent_id: null,
        capture_status: null, // jamais passé par Stripe
      }),
    ]);

    await expect(page.getByText(`#${UNPAID_ORDER_ID.slice(0, 8)}`)).toHaveCount(0);
  });
});

test.describe("Client — la commande payée naît au statut « pending »", () => {
  test("le paiement crée la commande avec le statut « pending » (En attente)", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder: BackendRecorder = await mockBackend(page, {
      tables: { restaurant_closures: [], profiles: [], addresses: [] },
      functions: {
        // Stripe.js est bloqué en test : réponse d'erreur contrôlée après
        // création de la commande, suffisante pour vérifier l'INSERT.
        "create-payment-intent": { body: { error: "Paiement indisponible (test E2E)" } },
        "cancel-order": { body: { success: true, capture_status: "cancelled" } },
      },
      onCreateOrder: (payload) => ({
        id: PAID_ORDER_ID,
        created_at: "2026-08-11T17:00:00.000Z",
        updated_at: "2026-08-11T17:00:00.000Z",
        status: "pending",
        capture_status: "pending",
        site: "conches",
        ...payload,
      }),
    });

    await page.clock.install({ time: new Date(IN_SERVICE_UTC) });
    await installFakeSession(page, base);
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [
        CART_STORAGE_KEY,
        JSON.stringify({
          items: [
            {
              pizza: {
                id: "margherita",
                name: "Margherita",
                description: "Tomate, mozzarella, basilic",
                ingredients: ["tomate", "mozzarella"],
                image: "",
                basePrice: 9,
                category: "classiques",
                isAvailable: true,
                hasSize: true,
                hasBase: true,
                hasSupplements: true,
              },
              size: { id: "senior", name: "Senior", price: 9, description: "26cm" },
              base: "tomate",
              supplements: [],
              quantity: 1,
            },
          ],
          selectedRestaurant: {
            id: "conches",
            name: CONCHES,
            address: "1 Place Carnot, 27190 Conches-en-Ouche",
            phone: "02.32.38.41.77",
            hours: "Mar-Dim: 18h-22h",
          },
          orderType: "emporter",
          pickupTime: "20:00",
          deliveryAddress: null,
        }),
      ] as const,
    );
    await page.goto(`${base}/cart`);
    await expect(page.getByText("Margherita").first()).toBeVisible();

    await page.getByRole("button", { name: /réglez pour finaliser votre commande/i }).click();

    // La commande est bien créée au statut « pending » — celui qui s'affiche
    // « En attente » dans le back-office — et jamais directement « confirmed ».
    await expect
      .poll(() => recorder.orderWrites.find((w) => w.method === "POST")?.body.status)
      .toBe("pending");
    const insert = recorder.orderWrites.find((w) => w.method === "POST");
    expect(insert?.body.status).not.toBe("confirmed");
    // La pré-autorisation Stripe est demandée pour cette même commande.
    await expect
      .poll(() => recorder.lastCall("create-payment-intent")?.body.order_id)
      .toBe(PAID_ORDER_ID);
  });
});
