import { expect, test, type Page } from "@playwright/test";

/**
 * E2E — Blocage du checkout quand un site est fermé / bloqué
 *
 * Vérifie que, même avec un panier déjà rempli :
 *   1. Le bandeau client affiche le bon titre et le bon message selon le
 *      type de blocage (« Commandes en ligne bloquées » vs « Site fermé »).
 *   2. Le bouton de commande est désactivé et reprend le libellé du blocage.
 *   3. Aucune commande n'est envoyée à l'API (aucun POST /rest/v1/orders).
 *
 * Les fermetures sont simulées en interceptant la requête REST
 * `restaurant_closures` : le test reste autonome (aucune donnée admin
 * réelle n'est modifiée) et ne nécessite pas de session authentifiée.
 */

const CART_STORAGE_KEY = "declic-cart-state";

const CART_STATE = {
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
      quantity: 2,
    },
  ],
  selectedRestaurant: {
    id: "conches",
    name: "Déclic Pizza Conches",
    address: "1 Place Carnot, 27190 Conches-en-Ouche",
    phone: "02.32.38.41.77",
    hours: "Mar-Dim: 18h-22h",
  },
  orderType: "emporter",
  pickupTime: null,
  deliveryAddress: null,
};

type ClosureType = "orders" | "site";

function closureRow(closure_type: ClosureType, reason: string) {
  return {
    id: `e2e-closure-${closure_type}`,
    site: "conches",
    closure_type,
    is_active: true,
    reason,
    end_at: null,
    created_by: "e2e",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Intercepte la lecture des fermetures et injecte un panier persistant. */
async function setupClosedSite(
  page: Page,
  base: string,
  closure_type: ClosureType,
  reason: string,
) {
  await page.route("**/rest/v1/restaurant_closures*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([closureRow(closure_type, reason)]),
    });
  });

  // Établir l'origine localhost avant d'écrire dans le localStorage.
  await page.goto(base);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CART_STORAGE_KEY, JSON.stringify(CART_STATE)] as const,
  );
}

test.describe("Checkout bloqué — blocage des commandes / fermeture du site", () => {
  test("« Commandes en ligne bloquées » : message affiché, bouton désactivé, aucune commande envoyée", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const reason = "Four en panne, commandes en ligne suspendues.";
    await setupClosedSite(page, base, "orders", reason);

    const orderPosts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/rest\/v1\/orders/.test(req.url())) {
        orderPosts.push(req.url());
      }
    });

    await page.goto(`${base}/cart`);

    // Le panier est bien rempli (le blocage n'efface pas le panier).
    await expect(page.getByText("Margherita").first()).toBeVisible();

    // 1) Bandeau client au bon libellé.
    await expect(
      page.getByText("Commandes en ligne bloquées").first(),
    ).toBeVisible();
    await expect(page.getByText(reason).first()).toBeVisible();

    // 2) Aucun bouton de commande n'est proposé pendant le blocage.
    await expect(
      page.getByRole("button", { name: /réglez pour finaliser votre commande/i }),
    ).toHaveCount(0);

    // 3) Aucune commande n'est créée pendant le blocage.
    await page.waitForTimeout(1000);
    expect(orderPosts).toHaveLength(0);
  });

  test("« Fermeture du site » : message « Site fermé », bouton désactivé, aucune commande envoyée", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const reason = "Le restaurant est fermé exceptionnellement ce soir.";
    await setupClosedSite(page, base, "site", reason);

    const orderPosts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/rest\/v1\/orders/.test(req.url())) {
        orderPosts.push(req.url());
      }
    });

    await page.goto(`${base}/cart`);

    await expect(page.getByText("Margherita").first()).toBeVisible();
    await expect(page.getByText("Site fermé").first()).toBeVisible();
    await expect(page.getByText(reason).first()).toBeVisible();

    const cta = page.getByRole("button", { name: /site fermé/i }).last();
    await expect(cta).toBeVisible();
    await expect(cta).toBeDisabled();

    await cta.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(1000);
    expect(orderPosts).toHaveLength(0);
  });

  test("sans blocage actif, le bouton n'affiche pas de message de fermeture", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";

    await page.route("**/rest/v1/restaurant_closures*", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto(base);
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [CART_STORAGE_KEY, JSON.stringify(CART_STATE)] as const,
    );
    await page.goto(`${base}/cart`);

    await expect(page.getByText("Margherita").first()).toBeVisible();
    await expect(
      page.getByText("Commandes en ligne bloquées"),
    ).toHaveCount(0);
    await expect(page.getByText("Site fermé")).toHaveCount(0);
  });
});
