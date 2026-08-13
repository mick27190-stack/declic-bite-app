import { expect, test, type Page } from "@playwright/test";

/**
 * E2E — Bandeau rouge « blocage admin » vs bouton « Commandes fermées »
 *
 * Règles vérifiées :
 *   1. Le bandeau rouge (blocage des commandes / fermeture du site) n'apparaît
 *      QUE lorsqu'un blocage admin est actif.
 *   2. Hors horaires (sans blocage admin), aucun bandeau rouge : le bouton
 *      d'ajout au panier affiche « Commandes fermées » et est désactivé.
 *   3. En horaires normaux et sans blocage, ni bandeau rouge ni « Commandes
 *      fermées » : le bouton « Ajouter au panier » reste actif.
 *
 * L'heure est figée avec l'API `clock` de Playwright et les fermetures sont
 * simulées en interceptant la requête REST `restaurant_closures` : le test est
 * autonome (aucune donnée admin réelle modifiée, aucune session requise).
 */

const CART_STORAGE_KEY = "declic-cart-state";

const CART_STATE = {
  items: [],
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
    id: `e2e-cta-${closure_type}`,
    site: "conches",
    closure_type,
    is_active: true,
    reason,
    end_at: null,
    created_by: "e2e",
    created_at: "2026-08-11T10:00:00.000Z",
    updated_at: "2026-08-11T10:00:00.000Z",
  };
}

/** Fige l'heure, simule (ou non) un blocage et prépare le site sélectionné. */
async function prepare(
  page: Page,
  base: string,
  parisIsoUtc: string,
  closure: { type: ClosureType; reason: string } | null,
) {
  await page.clock.install({ time: new Date(parisIsoUtc) });

  await page.route("**/rest/v1/restaurant_closures*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        closure ? [closureRow(closure.type, closure.reason)] : [],
      ),
    });
  });

  await page.goto(base);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CART_STORAGE_KEY, JSON.stringify(CART_STATE)] as const,
  );
  await page.goto(`${base}/menu`);
}

/** Ouvre la fiche détaillée de la première pizza du menu. */
async function openFirstPizza(page: Page) {
  const card = page.locator("button.pizza-card").first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("button", { name: /^$|.*/ }).first()).toBeVisible();
}

// Mardi 11 août 2026 : 19h00 Paris (UTC+2) et 23h00 Paris.
const IN_HOURS_UTC = "2026-08-11T17:00:00.000Z";
const OUT_OF_HOURS_UTC = "2026-08-11T21:00:00.000Z";

test.describe("Bandeau de blocage vs bouton « Commandes fermées »", () => {
  test("blocage admin en horaires : bandeau rouge affiché, pas de « Commandes fermées »", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const reason = "Four en panne, commandes en ligne suspendues.";
    await prepare(page, base, IN_HOURS_UTC, { type: "orders", reason });

    // 1) Bandeau rouge sur le menu.
    await expect(
      page.getByText("Commandes en ligne bloquées").first(),
    ).toBeVisible();
    await expect(page.getByText(reason).first()).toBeVisible();

    // 2) Dans la fiche produit : bandeau rouge, aucun bouton « Commandes fermées ».
    await openFirstPizza(page);
    await expect(
      page.getByText("Commandes en ligne bloquées").last(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Commandes fermées" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Ajouter au panier/i }),
    ).toHaveCount(0);
  });

  test("fermeture du site en horaires : bandeau « Site fermé » affiché", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    const reason = "Le restaurant est fermé exceptionnellement ce soir.";
    await prepare(page, base, IN_HOURS_UTC, { type: "site", reason });

    await expect(page.getByText("Site fermé").first()).toBeVisible();
    await expect(page.getByText(reason).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Commandes fermées" }),
    ).toHaveCount(0);
  });

  test("hors horaires sans blocage : bouton « Commandes fermées », aucun bandeau rouge", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await prepare(page, base, OUT_OF_HOURS_UTC, null);

    // Aucun libellé de blocage admin.
    await expect(page.getByText("Commandes en ligne bloquées")).toHaveCount(0);
    await expect(page.getByText("Site fermé")).toHaveCount(0);

    await openFirstPizza(page);

    const cta = page.getByRole("button", { name: "Commandes fermées" }).last();
    await expect(cta).toBeVisible();
    await expect(cta).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Ajouter au panier/i }),
    ).toHaveCount(0);
  });

  test("en horaires sans blocage : bouton « Ajouter au panier » actif", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await prepare(page, base, IN_HOURS_UTC, null);

    await expect(page.getByText("Commandes en ligne bloquées")).toHaveCount(0);
    await expect(page.getByText("Site fermé")).toHaveCount(0);

    await openFirstPizza(page);

    const cta = page.getByRole("button", { name: /Ajouter au panier/i }).last();
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Commandes fermées" }),
    ).toHaveCount(0);
  });
});
