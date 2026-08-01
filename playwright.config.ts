import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright pour les tests E2E de Déclic Pizza.
 *
 * Le serveur Vite doit être démarré séparément (bun run dev) et écouter
 * sur http://localhost:8080. Les tests attendent qu'une session Supabase
 * du client soit injectée via les variables d'environnement
 * LOVABLE_BROWSER_SUPABASE_* (voir e2e/README.md).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    viewport: { width: 1280, height: 1800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    headless: true,
    launchOptions: process.env.E2E_CHROME_PATH
      ? { executablePath: process.env.E2E_CHROME_PATH }
      : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
