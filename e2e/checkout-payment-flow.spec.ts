import { expect, test, type Page } from "@playwright/test";
import { mockBackend, installFakeSession, type BackendRecorder } from "./helpers/mockBackend";

/**
 * E2E — Flux de commande client : à emporter et en livraison
 *
 * Couvre le contrat complet côté client :
 *   1. Création de la commande en base (POST /rest/v1/orders) avec le bon
 *      `order_type`, le créneau demandé et l'adresse de livraison.
 *   2. Ouverture de la pré-autorisation bancaire : appel de l'Edge Function
 *      `create-payment-intent` avec l'`order_id` créé.
 *   3. Message de pré-autorisation adapté (emporter vs livraison).
 *   4. Annulation depuis le dialogue : appel de `cancel-order` (libération de
 *      la pré-autorisation) et fermeture du dialogue.
 *
 * Backend, auth et Stripe sont entièrement simulés (voir helpers/mockBackend).
 * Heure figée un mardi 19h00 Paris pour rester dans les horaires de service.
 */

const CART_STORAGE_KEY = "declic-cart-state";
const IN_SERVICE_UTC = "2026-08-11T17:00:00.000Z"; // mardi 11/08/2026, 19h00 Paris
const ORDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const PIZZA_ITEM = {
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
  quantity: 2,
};

const RESTAURANT = {
  id: "conches",
  name: "Déclic Pizza Conches",
  address: "1 Place Carnot, 27190 Conches-en-Ouche",
  phone: "02.32.38.41.77",
  hours: "Mar-Dim: 18h-22h",
};

function cartState(orderType: "emporter" | "livraison") {
  return {
    items: [PIZZA_ITEM],
    selectedRestaurant: RESTAURANT,
    orderType,
    pickupTime: "20:00",
    deliveryAddress:
      orderType === "livraison"
        ? {
            address: "12 Rue de la Paix, 27190 Conches-en-Ouche",
            coordinates: { lat: 48.96, lng: 0.94 },
            postalCode: "27190",
            city: "Conches-en-Ouche",
          }
        : null,
  };
}

/** Prépare l'app : backend simulé, session, heure figée et panier pré-rempli. */
async function prepareCart(
  page: Page,
  base: string,
  orderType: "emporter" | "livraison",
  paymentIntent: { status?: number; body: Record<string, unknown> },
): Promise<BackendRecorder> {
  const recorder = await mockBackend(page, {
    tables: { restaurant_closures: [], profiles: [], addresses: [] },
    functions: {
      "create-payment-intent": paymentIntent,
      "cancel-order": { body: { success: true, capture_status: "cancelled" } },
    },
    onCreateOrder: (payload) => ({
      id: ORDER_ID,
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
    [CART_STORAGE_KEY, JSON.stringify(cartState(orderType))] as const,
  );
  await page.goto(`${base}/cart`);
  await expect(page.getByText("Margherita").first()).toBeVisible();
  return recorder;
}

test.describe("Flux de paiement client — à emporter", () => {
  test("crée la commande, pré-autorise puis libère la pré-autorisation à l'annulation", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    // La pré-autorisation renvoie une erreur contrôlée : le dialogue affiche
    // l'état d'erreur au lieu de charger Stripe.js (bloqué en test), ce qui
    // permet de vérifier le bouton « Annuler la commande ».
    const recorder = await prepareCart(page, base, "emporter", {
      status: 200,
      body: { error: "Paiement indisponible (test E2E)" },
    });

    await page.getByRole("button", { name: /commander maintenant/i }).click();

    // 1) Commande créée avec le bon type et le créneau demandé.
    await expect.poll(() => recorder.orderWrites.length).toBeGreaterThan(0);
    const insert = recorder.orderWrites.find((w) => w.method === "POST");
    expect(insert?.body.order_type).toBe("emporter");
    expect(insert?.body.pickup_time).toBe("20:00");
    expect(insert?.body.status).toBe("pending");
    expect(insert?.body.delivery_address).toBeNull();

    // 2) Pré-autorisation demandée pour cette commande.
    await expect
      .poll(() => recorder.lastCall("create-payment-intent")?.body.order_id)
      .toBe(ORDER_ID);

    // 3) Dialogue de paiement ouvert.
    await expect(page.getByText("Paiement sécurisé")).toBeVisible();
    await expect(page.getByText(/Commande à emporter/i)).toBeVisible();

    // 4) Annulation : la pré-autorisation Stripe est libérée.
    await page.getByRole("button", { name: /annuler la commande/i }).click();
    await expect.poll(() => recorder.countCalls("cancel-order")).toBe(1);
    expect(recorder.lastCall("cancel-order")?.body.order_id).toBe(ORDER_ID);
    await expect(page.getByText("Paiement sécurisé")).toBeHidden();
  });
});

test.describe("Flux de paiement client — livraison", () => {
  test("transmet l'adresse et ouvre la pré-autorisation livraison", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await prepareCart(page, base, "livraison", {
      status: 200,
      body: { error: "Paiement indisponible (test E2E)" },
    });

    await page.getByRole("button", { name: /commander maintenant/i }).click();

    await expect.poll(() => recorder.orderWrites.length).toBeGreaterThan(0);
    const insert = recorder.orderWrites.find((w) => w.method === "POST");
    expect(insert?.body.order_type).toBe("livraison");
    expect(insert?.body.pickup_time).toBe("20:00");
    expect((insert?.body.delivery_address as Record<string, unknown>)?.city).toBe(
      "Conches-en-Ouche",
    );

    await expect
      .poll(() => recorder.lastCall("create-payment-intent")?.body.order_id)
      .toBe(ORDER_ID);
    await expect(page.getByText(/Commande en livraison/i)).toBeVisible();

    await page.getByRole("button", { name: /annuler la commande/i }).click();
    await expect.poll(() => recorder.countCalls("cancel-order")).toBe(1);
  });

  test("aucune commande n'est créée tant que le créneau de livraison est absent", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const recorder = await mockBackend(page, {
      tables: { restaurant_closures: [], profiles: [], addresses: [] },
    });
    await page.clock.install({ time: new Date(IN_SERVICE_UTC) });
    await installFakeSession(page, base);
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [
        CART_STORAGE_KEY,
        JSON.stringify({ ...cartState("livraison"), pickupTime: null }),
      ] as const,
    );
    await page.goto(`${base}/cart`);

    const cta = page.getByRole("button", { name: /choisissez une heure/i }).last();
    await expect(cta).toBeDisabled();
    await cta.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(500);
    expect(recorder.orderWrites.filter((w) => w.method === "POST")).toHaveLength(0);
  });
});
