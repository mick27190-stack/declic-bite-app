import { expect, test, type Page } from "@playwright/test";
import { mockBackend, installFakeSession, TEST_USER_ID } from "./helpers/mockBackend";

/**
 * E2E — Fidélité : récompense acquise le dernier jour du programme
 *
 * Scénario en deux commandes, avec un programme Senior dont la date de fin est
 * « aujourd'hui » :
 *   1. Commande n°1 (le dernier jour) : la carte affiche 9/10, aucune remise
 *      n'est visible dans le panier et le total facturé est le total plein.
 *      Cette commande fait passer le compteur à 10 → récompense acquise.
 *   2. Commande n°2 (le lendemain, programme terminé) : la carte reste visible
 *      avec la récompense en attente, le panier affiche « Remise fidélité »
 *      et le total final est bien diminué du montant offert.
 *
 * Vérifie aussi que le cumul par taille remonte correctement dans l'UI
 * (remise Senior + remise Méga sur une même commande).
 *
 * Backend entièrement simulé (voir helpers/mockBackend) : la fonction SQL
 * `preview_loyalty_discount` est mockée, ses règles sont testées séparément
 * (src/lib/loyalty.test.ts et supabase/functions/loyalty-tests).
 */

const CART_STORAGE_KEY = "declic-cart-state";
// Mardi 11/08/2026 19h00 Paris (dernier jour du programme), puis J+1.
const LAST_DAY_UTC = "2026-08-11T17:00:00.000Z";
const NEXT_DAY_UTC = "2026-08-12T17:00:00.000Z";
const LAST_DAY = "2026-08-11";
const ORDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const SENIOR_PROGRAM = {
  id: "10000000-0000-4000-8000-000000000001",
  site: "conches",
  category: "senior",
  enabled: true,
  start_date: "2026-08-01",
  end_date: LAST_DAY,
  required_count: 10,
  reward_type: "free_pizza",
  discount_amount: null,
};

const MEGA_PROGRAM = {
  id: "10000000-0000-4000-8000-000000000002",
  site: "conches",
  category: "mega",
  enabled: true,
  start_date: "2026-08-01",
  end_date: null,
  required_count: 10,
  reward_type: "free_pizza",
  discount_amount: null,
};

const RESTAURANT = {
  id: "conches",
  name: "Déclic Pizza Conches",
  address: "1 Place Carnot, 27190 Conches-en-Ouche",
  phone: "02.32.38.41.77",
  hours: "Mar-Dim: 18h-22h",
};

function pizza(sizeId: string, sizeName: string, price: number) {
  return {
    pizza: {
      id: `margherita-${sizeId}`,
      name: "Margherita",
      description: "Tomate, mozzarella, basilic",
      ingredients: ["tomate", "mozzarella"],
      image: "",
      basePrice: price,
      category: "classiques",
      isAvailable: true,
      hasSize: true,
      hasBase: true,
      hasSupplements: true,
    },
    size: { id: sizeId, name: sizeName, price, description: "" },
    base: "tomate",
    supplements: [],
    quantity: 1,
  };
}

const SENIOR_PIZZA = pizza("senior", "Senior", 13.5);
const MEGA_PIZZA = pizza("mega", "Méga", 20);

function cartState(items: unknown[]) {
  return {
    items,
    selectedRestaurant: RESTAURANT,
    orderType: "emporter",
    pickupTime: "20:00",
    deliveryAddress: null,
  };
}

async function seedCart(page: Page, base: string, items: unknown[]) {
  await installFakeSession(page, base);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CART_STORAGE_KEY, JSON.stringify(cartState(items))] as const,
  );
}

test.describe("Fidélité — remise acquise le dernier jour, utilisée à la commande suivante", () => {
  test("aucune remise à la commande du dernier jour, remise appliquée à la suivante", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";

    // État backend mutable : il évolue entre la 1re et la 2e commande.
    const tables: Record<string, unknown[]> = {
      restaurant_closures: [],
      profiles: [],
      addresses: [],
      loyalty_programs: [SENIOR_PROGRAM, MEGA_PROGRAM],
      customer_loyalty_progress: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          customer_id: TEST_USER_ID,
          program_id: SENIOR_PROGRAM.id,
          current_count: 9,
        },
      ],
      loyalty_rewards_pending: [],
    };
    const rpc: Record<string, unknown> = {
      // Dernier jour : la 10e pizza est comptée mais rien n'est encore offert.
      preview_loyalty_discount: { total_discount: 0, items: [] },
    };

    const recorder = await mockBackend(page, {
      tables,
      rpc,
      functions: {
        "create-payment-intent": {
          status: 200,
          body: { error: "Paiement indisponible (test E2E)" },
        },
        "cancel-order": { body: { success: true, capture_status: "cancelled" } },
      },
      onCreateOrder: (payload) => ({
        id: ORDER_ID,
        created_at: LAST_DAY_UTC,
        updated_at: LAST_DAY_UTC,
        status: "pending",
        capture_status: "pending",
        site: "conches",
        ...payload,
      }),
    });

    // ---------- Commande n°1 : le dernier jour du programme ----------
    await page.clock.install({ time: new Date(LAST_DAY_UTC) });
    await seedCart(page, base, [SENIOR_PIZZA]);

    // Carte de fidélité : 9/10, aucune récompense disponible.
    await page.goto(`${base}/loyalty`);
    await expect(page.getByText("Pizzas Senior")).toBeVisible();
    await expect(page.getByText("9/10")).toBeVisible();
    await expect(page.getByText(/Récompense disponible/i)).toHaveCount(0);

    // Panier : pas de ligne de remise, total plein.
    await page.goto(`${base}/cart`);
    await expect(page.getByText("Margherita").first()).toBeVisible();
    await expect(page.getByText("Remise fidélité")).toHaveCount(0);
    await expect(page.locator("span.text-2xl").last()).toHaveText("13.50€");

    await page.getByRole("button", { name: /commander maintenant/i }).click();
    await expect.poll(() => recorder.orderWrites.length).toBeGreaterThan(0);
    const firstInsert = recorder.orderWrites.find((w) => w.method === "POST");
    expect(Number(firstInsert?.body.total_price)).toBeCloseTo(13.5, 2);

    await page.getByRole("button", { name: /annuler la commande/i }).click();
    await expect.poll(() => recorder.countCalls("cancel-order")).toBe(1);

    // ---------- Le programme se termine, la récompense reste acquise ----------
    tables.loyalty_programs = [
      { ...SENIOR_PROGRAM, end_date: LAST_DAY }, // terminé depuis hier
      MEGA_PROGRAM,
    ];
    tables.customer_loyalty_progress = [
      {
        id: "20000000-0000-4000-8000-000000000001",
        customer_id: TEST_USER_ID,
        program_id: SENIOR_PROGRAM.id,
        current_count: 10,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        customer_id: TEST_USER_ID,
        program_id: MEGA_PROGRAM.id,
        current_count: 10,
      },
    ];
    tables.loyalty_rewards_pending = [
      {
        id: "30000000-0000-4000-8000-000000000001",
        customer_id: TEST_USER_ID,
        program_id: SENIOR_PROGRAM.id,
        status: "pending",
        created_at: LAST_DAY_UTC,
        applied_order_id: null,
      },
      {
        id: "30000000-0000-4000-8000-000000000002",
        customer_id: TEST_USER_ID,
        program_id: MEGA_PROGRAM.id,
        status: "pending",
        created_at: LAST_DAY_UTC,
        applied_order_id: null,
      },
    ];
    // Cumul des deux tailles sur la commande suivante : 13,50 € + 20 €.
    rpc.preview_loyalty_discount = {
      total_discount: 33.5,
      items: [
        {
          program_id: SENIOR_PROGRAM.id,
          category: "senior",
          reward_type: "free_pizza",
          amount: 13.5,
          size_id: "senior",
        },
        {
          program_id: MEGA_PROGRAM.id,
          category: "mega",
          reward_type: "free_pizza",
          amount: 20,
          size_id: "mega",
        },
      ],
    };

    // ---------- Commande n°2 : le lendemain, programme Senior terminé ----------
    await page.clock.install({ time: new Date(NEXT_DAY_UTC) });
    await seedCart(page, base, [SENIOR_PIZZA, MEGA_PIZZA]);

    // La carte affiche toujours le programme terminé tant que la récompense
    // acquise n'a pas été utilisée.
    await page.goto(`${base}/loyalty`);
    await expect(page.getByText("Pizzas Senior")).toBeVisible();
    await expect(
      page.getByText(/Récompense disponible sur ta prochaine pizza Senior/i),
    ).toBeVisible();
    await expect(
      page.getByText(/Récompense disponible sur ta prochaine pizza Méga/i),
    ).toBeVisible();

    // Panier : la remise cumulée s'affiche et le total final est réduit.
    await page.goto(`${base}/cart`);
    await expect(page.getByText("Remise fidélité")).toBeVisible();
    await expect(page.getByText("-33.50€")).toBeVisible();
    // 13,50 + 20 = 33,50 € de panier, entièrement offerts.
    await expect(page.locator("span.text-2xl").last()).toHaveText("0.00€");
  });
});
