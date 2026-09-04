// Tests d'intégration du moteur de fidélité (`public.compute_loyalty_discount`).
//
// Deux cas critiques sont couverts :
//   1. « Dernier jour » : une récompense acquise avant la fin d'un programme
//      reste utilisable après la date de fin (ou après désactivation).
//   2. Cumul par taille : Senior, Méga et Super Méga s'appliquent
//      simultanément dans une même commande.
//
// Chaque test s'exécute dans une transaction annulée (ROLLBACK) : les
// programmes réels ne sont jamais modifiés durablement et aucune donnée de
// test ne subsiste. Les tests sont ignorés si SUPABASE_DB_URL est absent.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DB_URL");
const HAS_DB = Boolean(DB_URL);

const TEST_SITE = "beaumont";

interface DiscountItem {
  program_id: string;
  category: string;
  reward_type: string;
  amount: number;
  size_id: string;
}
interface DiscountResult {
  total_discount: number;
  items: DiscountItem[];
}

function pizzaItem(sizeId: string, quantity = 1) {
  return {
    pizza: {
      id: `loyalty-test-${sizeId}`,
      name: `Test ${sizeId}`,
      description: "",
      ingredients: [],
      image: "",
      basePrice: 12,
      category: "classiques",
      isAvailable: true,
    },
    size: { id: sizeId, name: sizeId, price: 12 },
    base: "tomate",
    supplements: [],
    quantity,
  };
}

/** Exécute `fn` dans une transaction systématiquement annulée. */
async function inRollbackTx(fn: (db: Client) => Promise<void>) {
  const db = new Client(DB_URL!);
  await db.connect();
  try {
    const { rows } = await db.queryObject<{ can_write: boolean }>(
      "SELECT has_table_privilege('public.loyalty_programs','UPDATE') AS can_write",
    );
    if (!rows[0]?.can_write) {
      console.warn(
        "Connexion en lecture seule : test d'intégration fidélité ignoré (nécessite un rôle avec droits d'écriture).",
      );
      return;
    }
    await db.queryArray("BEGIN");
    await fn(db);
  } finally {
    await db.queryArray("ROLLBACK").catch(() => undefined);
    await db.end();
  }
}


async function programId(db: Client, category: string): Promise<string> {
  const { rows } = await db.queryObject<{ id: string }>(
    "SELECT id FROM public.loyalty_programs WHERE site = $1 AND category = $2::public.loyalty_category",
    [TEST_SITE, category],
  );
  assert(rows[0], `programme ${category} introuvable sur ${TEST_SITE}`);
  return rows[0].id;
}

async function computeDiscount(
  db: Client,
  customerId: string,
  items: unknown[],
): Promise<DiscountResult> {
  const { rows } = await db.queryObject<{ result: DiscountResult }>(
    "SELECT public.compute_loyalty_discount($1::uuid, $2::text, $3::jsonb, now(), false, NULL) AS result",
    [customerId, TEST_SITE, JSON.stringify(items)],
  );
  return rows[0].result;
}

Deno.test({
  name: "fidélité — récompense acquise le dernier jour reste utilisable après la fin du programme",
  ignore: !HAS_DB,
  async fn() {
    await inRollbackTx(async (db) => {
      const customerId = crypto.randomUUID();
      const senior = await programId(db, "senior");

      // Programme terminé hier (dernier jour = hier) et désactivé depuis.
      await db.queryArray(
        `UPDATE public.loyalty_programs
            SET enabled = false, start_date = NULL,
                end_date = (now() AT TIME ZONE 'Europe/Paris')::date - 1,
                required_count = 10, reward_type = 'free_pizza', discount_amount = NULL
          WHERE id = $1`,
        [senior],
      );

      // Récompense acquise le dernier jour, pas encore consommée.
      await db.queryArray(
        `INSERT INTO public.loyalty_rewards_pending (customer_id, program_id, status)
         VALUES ($1, $2, 'pending')`,
        [customerId, senior],
      );

      const result = await computeDiscount(db, customerId, [pizzaItem("senior")]);

      assert(
        Number(result.total_discount) > 0,
        `la récompense doit rester utilisable après la fin du programme (reçu ${result.total_discount})`,
      );
      assertEquals(result.items.length, 1);
      assertEquals(result.items[0].reward_type, "free_pizza");
      assertEquals(result.items[0].size_id, "senior");

      // Un programme terminé ne fait plus gagner de nouvelle récompense :
      // seule la récompense déjà acquise est consommée.
      const second = await computeDiscount(db, customerId, [
        pizzaItem("senior"),
        pizzaItem("senior"),
      ]);
      assertEquals(second.items.length, 1);

      // Sans récompense en attente, un programme terminé ne remise rien.
      const other = crypto.randomUUID();
      const none = await computeDiscount(db, other, [pizzaItem("senior")]);
      assertEquals(Number(none.total_discount), 0);
      assertEquals(none.items.length, 0);
    });
  },
});

Deno.test({
  name: "fidélité — les remises Senior, Méga et Super Méga se cumulent dans une même commande",
  ignore: !HAS_DB,
  async fn() {
    await inRollbackTx(async (db) => {
      const customerId = crypto.randomUUID();

      for (const category of ["senior", "mega", "super_mega"]) {
        const id = await programId(db, category);
        await db.queryArray(
          `UPDATE public.loyalty_programs
              SET enabled = true, start_date = NULL, end_date = NULL,
                  required_count = 10, reward_type = 'free_pizza', discount_amount = NULL
            WHERE id = $1`,
          [id],
        );
        await db.queryArray(
          `INSERT INTO public.loyalty_rewards_pending (customer_id, program_id, status)
           VALUES ($1, $2, 'pending')`,
          [customerId, id],
        );
      }

      const result = await computeDiscount(db, customerId, [
        pizzaItem("senior"),
        pizzaItem("mega"),
        pizzaItem("super-mega"),
      ]);

      assertEquals(
        result.items.length,
        3,
        "les trois récompenses doivent s'appliquer dans la même commande",
      );
      assertEquals(
        result.items.map((i) => i.category).sort(),
        ["mega", "senior", "super_mega"],
      );

      // Une seule remise par taille, et total = somme des lignes.
      const perCategory = new Map<string, number>();
      for (const i of result.items) {
        perCategory.set(i.category, (perCategory.get(i.category) ?? 0) + 1);
      }
      for (const [category, count] of perCategory) {
        assertEquals(count, 1, `une seule remise attendue pour ${category}`);
      }
      const sum = result.items.reduce((acc, i) => acc + Number(i.amount), 0);
      assertEquals(Number(Number(result.total_discount).toFixed(2)), Number(sum.toFixed(2)));
      assert(Number(result.total_discount) > 0, "le cumul doit produire une remise");
    });
  },
});
