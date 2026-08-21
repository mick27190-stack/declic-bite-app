import { expect, test, type Browser } from "@playwright/test";

/**
 * E2E — Créneaux de livraison aux heures limites (heure de Paris).
 *
 * Règles vérifiées :
 *   - 21h08 : « Dès que possible » = 21h45 (grâce de 8 min sur le quart d'heure).
 *   - 21h09 → 21h16 : seul le dernier créneau 22h00 est proposé, commandes ouvertes.
 *   - 21h17 : livraison bloquée, le bouton CTA affiche « Commandes fermées ».
 *
 * Les tests tournent avec un fuseau appareil volontairement différent
 * (America/New_York puis Australia/Sydney) pour prouver que les créneaux sont
 * toujours calculés sur l'heure de Paris, quel que soit le fuseau du client.
 */

const DEVICE_TIMEZONES = ["America/New_York", "Australia/Sydney"] as const;

async function openPreview(browser: Browser, timezoneId: string, parisTime: string) {
  const context = await browser.newContext({ timezoneId, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(
    `/dev/cutoff-preview?t=${encodeURIComponent(parisTime)}&type=livraison`,
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.getByTestId("virtual-now")).toHaveText(
    `Virtual Paris time: ${parisTime}`,
  );
  return { context, page };
}

for (const timezoneId of DEVICE_TIMEZONES) {
  test.describe(`créneaux livraison — appareil en ${timezoneId}`, () => {
    test("21h08 Paris : « Dès que possible » = 21h45, commandes ouvertes", async ({
      browser,
    }) => {
      const { context, page } = await openPreview(browser, timezoneId, "21:08");
      await expect(page.getByTestId("paris-minutes")).toHaveText(String(21 * 60 + 8));
      await expect(page.getByTestId("delivery-asap")).toHaveText("21:45");
      await expect(page.getByTestId("delivery-slots")).toHaveText("22:00");
      await expect(page.getByTestId("delivery-cutoff")).toHaveText("open");
      await expect(page.getByTestId("order-button")).toBeEnabled();
      await context.close();
    });

    test("21h09 Paris : dernier créneau 22h00 uniquement", async ({ browser }) => {
      const { context, page } = await openPreview(browser, timezoneId, "21:09");
      await expect(page.getByTestId("delivery-asap")).toHaveText("22:00");
      await expect(page.getByTestId("delivery-slots")).toHaveText("");
      await expect(page.getByTestId("delivery-last-slot-valid")).toHaveText("valid");
      await expect(page.getByTestId("delivery-cutoff")).toHaveText("open");
      await context.close();
    });

    test("21h16 Paris : dernière minute acceptée, créneau 22h00 valide", async ({
      browser,
    }) => {
      const { context, page } = await openPreview(browser, timezoneId, "21:16");
      await expect(page.getByTestId("delivery-asap")).toHaveText("22:00");
      await expect(page.getByTestId("delivery-last-slot-valid")).toHaveText("valid");
      await expect(page.getByTestId("delivery-cutoff")).toHaveText("open");
      await expect(page.getByTestId("order-button")).toBeEnabled();
      await context.close();
    });

    test("21h17 Paris : livraison bloquée avec « Commandes fermées »", async ({
      browser,
    }) => {
      const { context, page } = await openPreview(browser, timezoneId, "21:17");
      await expect(page.getByTestId("delivery-cutoff")).toHaveText("closed");
      const button = page.getByTestId("order-button");
      await expect(button).toBeDisabled();
      await expect(button).toHaveText("Commandes fermées");
      await context.close();
    });
  });
}
