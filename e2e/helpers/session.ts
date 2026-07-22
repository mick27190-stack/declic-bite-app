import type { BrowserContext, Page } from "@playwright/test";

/**
 * Restaure la session Supabase injectée par l'environnement Lovable
 * (LOVABLE_BROWSER_SUPABASE_*) dans le contexte du navigateur, afin que
 * les tests E2E s'exécutent en tant que l'utilisateur connecté dans le
 * preview.
 */
export async function restoreSupabaseSession(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
) {
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

  if (!storageKey || !sessionJson) {
    throw new Error(
      "Session Supabase absente. Connectez-vous dans le preview Lovable puis relancez les tests.",
    );
  }

  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({
      ...c,
      url: baseUrl,
    }));
    await context.addCookies(cookies);
  }

  await page.goto(baseUrl);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, sessionJson] as const,
  );
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante: ${name}`);
  return value;
}
