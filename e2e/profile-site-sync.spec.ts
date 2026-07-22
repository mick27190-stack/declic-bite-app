import { expect, test } from "@playwright/test";
import { restoreSupabaseSession } from "./helpers/session";
import { getSupabaseAdmin } from "./helpers/supabase";

/**
 * E2E — Synchronisation du site préféré (profil client → fiche client admin)
 *
 * Ce test vérifie le contrat du trigger `sync_customer_from_profile` :
 *   1. Le client modifie son site préféré depuis /profile.
 *   2. La colonne `preferred_restaurant` du profil est mise à jour.
 *   3. La colonne `site` de la fiche `customers` correspondante reflète
 *      immédiatement la nouvelle valeur (visible côté admin).
 *
 * Pré-requis (voir e2e/README.md) :
 *   - Le serveur de dev tourne (bun run dev, http://localhost:8080).
 *   - Un utilisateur client est connecté dans le preview Lovable
 *     (LOVABLE_BROWSER_SUPABASE_* injectées).
 *   - E2E_SUPABASE_URL + E2E_SUPABASE_SERVICE_ROLE_KEY exposés pour
 *     valider la ligne customers côté serveur.
 */
test.describe("Profil client → Fiche admin — site préféré", () => {
  test("le choix du site dans /profile se reflète dans la table customers", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8080";
    await restoreSupabaseSession(context, page, base);

    // Récupérer l'ID utilisateur depuis la session injectée.
    const session = JSON.parse(
      process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON!,
    );
    const userId: string = session.user.id;
    const supabase = getSupabaseAdmin();

    // État initial pour calculer la valeur cible (on bascule sur l'autre site).
    const { data: initial } = await supabase
      .from("profiles")
      .select("preferred_restaurant")
      .eq("id", userId)
      .maybeSingle();
    const initialSite = (initial?.preferred_restaurant ?? "") as string;
    const targetSite = initialSite === "conches" ? "beaumont" : "conches";

    // 1) Aller dans le profil et passer en édition.
    await page.goto(`${base}/profile`);
    await page.getByRole("button", { name: /modifier|éditer/i }).first().click();

    // 2) Sélectionner l'autre site dans le select "Site de commande".
    const siteSelect = page.locator("select").filter({
      has: page.locator('option[value="conches"]'),
    });
    await siteSelect.selectOption(targetSite);

    // 3) Enregistrer.
    await page
      .getByRole("button", { name: /enregistrer|sauvegarder/i })
      .first()
      .click();

    // 4) Vérifier la mise à jour côté DB avec un petit polling.
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("profiles")
            .select("preferred_restaurant")
            .eq("id", userId)
            .maybeSingle();
          return data?.preferred_restaurant;
        },
        { timeout: 10_000, message: "profiles.preferred_restaurant non mis à jour" },
      )
      .toBe(targetSite);

    // 5) La fiche customers doit refléter le même site (déclenché par
    //    sync_customer_from_profile).
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("customers")
            .select("site")
            .eq("user_id", userId)
            .maybeSingle();
          return data?.site;
        },
        { timeout: 10_000, message: "customers.site non synchronisé" },
      )
      .toBe(targetSite);
  });
});
