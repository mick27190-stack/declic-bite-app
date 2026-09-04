// Tests d'intégration du moteur de fidélité (`public.compute_loyalty_discount`).
//
// Deux cas critiques sont couverts :
//   1. « Dernier jour » : une récompense acquise avant la fin d'un programme
//      reste utilisable après la date de fin (ou après désactivation).
//   2. Cumul par taille : Senior, Méga et Super Méga s'appliquent
//      simultanément dans une même commande.
//
// Les tests utilisent la clé service_role (ils sont automatiquement ignorés
// sans elle). Les programmes réels du site de test sont sauvegardés puis
// restaurés, et toutes les lignes créées sont supprimées en fin de test.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const HAS_SERVICE_ROLE = Boolean(SERVICE_ROLE_KEY);

const TEST_SITE = "beaumont";

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface ProgramRow {
  id: string;
  category: string;
  enabled: boolean;
  start_date: string | null;
  end_date: string | null;
  required_count: number;
  reward_type: string;
  discount_amount: number | null;
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

/** Sauvegarde les programmes du site de test pour restauration en fin de test. */
async function snapshotPrograms(admin: SupabaseClient): Promise<ProgramRow[]> {
  const { data, error } = await admin
    .from("loyalty_programs")
    .select("id, category, enabled, start_date, end_date, required_count, reward_type, discount_amount")
    .eq("site", TEST_SITE);
  if (error) throw new Error(`snapshot failed: ${error.message}`);
  return (data ?? []) as ProgramRow[];
}

async function restorePrograms(admin: SupabaseClient, snapshot: ProgramRow[]) {
  for (const p of snapshot) {
    await admin
      .from("loyalty_programs")
      .update({
        enabled: p.enabled,
        start_date: p.start_date,
        end_date: p.end_date,
        required_count: p.required_count,
        reward_type: p.reward_type,
        discount_amount: p.discount_amount,
      })
      .eq("id", p.id);
  }
}

async function cleanupCustomer(admin: SupabaseClient, customerId: string) {
  await admin.from("loyalty_rewards_pending").delete().eq("customer_id", customerId);
  await admin.from("customer_loyalty_progress").delete().eq("customer_id", customerId);
  await admin.from("notifications").delete().eq("user_id", customerId);
}

async function computeDiscount(
  admin: SupabaseClient,
  customerId: string,
  items: unknown[],
) {
  const { data, error } = await admin.rpc("compute_loyalty_discount", {
    _user_id: customerId,
    _site: TEST_SITE,
    _items: items,
    _commit: false,
  });
  if (error) throw new Error(`compute_loyalty_discount failed: ${error.message}`);
  return data as { total_discount: number; items: Array<Record<string, unknown>> };
}

Deno.test({
  name: "fidélité — récompense acquise le dernier jour reste utilisable après la fin du programme",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const snapshot = await snapshotPrograms(admin);
    const customerId = crypto.randomUUID();

    try {
      const senior = snapshot.find((p) => p.category === "senior")!;
      assert(senior, "programme Senior introuvable sur le site de test");

      // Programme terminé hier (dernier jour = hier) et désactivé.
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      await admin
        .from("loyalty_programs")
        .update({
          enabled: false,
          start_date: null,
          end_date: yesterday,
          required_count: 10,
          reward_type: "free_pizza",
          discount_amount: null,
        })
        .eq("id", senior.id);

      // Récompense acquise avant la fin, non encore consommée.
      const { error: insertError } = await admin
        .from("loyalty_rewards_pending")
        .insert({ customer_id: customerId, program_id: senior.id, status: "pending" });
      assertEquals(insertError, null);

      const result = await computeDiscount(admin, customerId, [pizzaItem("senior")]);

      assert(
        result.total_discount > 0,
        `la récompense doit rester utilisable après la fin du programme (reçu ${result.total_discount})`,
      );
      assertEquals(result.items.length, 1);
      assertEquals(result.items[0].reward_type, "free_pizza");
      assertEquals(result.items[0].size_id, "senior");

      // Aucune nouvelle progression ne doit être gagnée sur un programme terminé.
      const second = await computeDiscount(admin, customerId, [
        pizzaItem("senior"),
        pizzaItem("senior"),
      ]);
      assertEquals(
        second.items.length,
        1,
        "une seule récompense en attente doit être consommée",
      );
    } finally {
      await cleanupCustomer(admin, customerId);
      await restorePrograms(admin, snapshot);
    }
  },
});

Deno.test({
  name: "fidélité — les remises Senior, Méga et Super Méga se cumulent dans une même commande",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const snapshot = await snapshotPrograms(admin);
    const customerId = crypto.randomUUID();

    try {
      const byCategory = new Map(snapshot.map((p) => [p.category, p]));
      for (const category of ["senior", "mega", "super_mega"]) {
        const prog = byCategory.get(category);
        assert(prog, `programme ${category} introuvable`);
        await admin
          .from("loyalty_programs")
          .update({
            enabled: true,
            start_date: null,
            end_date: null,
            required_count: 10,
            reward_type: "free_pizza",
            discount_amount: null,
          })
          .eq("id", prog!.id);
        const { error } = await admin
          .from("loyalty_rewards_pending")
          .insert({ customer_id: customerId, program_id: prog!.id, status: "pending" });
        assertEquals(error, null);
      }

      const result = await computeDiscount(admin, customerId, [
        pizzaItem("senior"),
        pizzaItem("mega"),
        pizzaItem("super-mega"),
      ]);

      assertEquals(
        result.items.length,
        3,
        "les trois récompenses doivent s'appliquer dans la même commande",
      );
      const categories = result.items.map((i) => i.category).sort();
      assertEquals(categories, ["mega", "senior", "super_mega"]);

      const sum = result.items.reduce((acc, i) => acc + Number(i.amount), 0);
      assertEquals(Number(result.total_discount.toFixed(2)), Number(sum.toFixed(2)));
      assert(result.total_discount > 0, "le cumul doit produire une remise");

      // Les programmes restent indépendants : une seule remise par taille.
      const perCategory = new Map<string, number>();
      for (const i of result.items) {
        const c = String(i.category);
        perCategory.set(c, (perCategory.get(c) ?? 0) + 1);
      }
      for (const [category, count] of perCategory) {
        assertEquals(count, 1, `une seule remise attendue pour ${category}`);
      }
    } finally {
      await cleanupCustomer(admin, customerId);
      await restorePrograms(admin, snapshot);
    }
  },
});
