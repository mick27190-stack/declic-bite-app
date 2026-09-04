import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Restaure la session Supabase injectée par l'environnement Lovable
 * (LOVABLE_BROWSER_SUPABASE_*) dans le contexte du navigateur, afin que
 * les tests E2E s'exécutent en tant que l'utilisateur connecté dans le
 * preview. Si les variables d'environnement sont absentes, on se rabat
 * sur la session générée via `lovable auth-session --json`
 * (~/.cache/lovable-auth/session.json).
 */
export async function restoreSupabaseSession(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
) {
  let storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  let sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  let cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

  if (!storageKey || !sessionJson) {
    const sessionFile = join(homedir(), ".cache/lovable-auth/session.json");
    if (existsSync(sessionFile)) {
      const minted = JSON.parse(readFileSync(sessionFile, "utf-8")) as {
        storage_key?: string;
        session?: unknown;
        cookies?: unknown;
      };
      storageKey = minted.storage_key;
      sessionJson = minted.session ? JSON.stringify(minted.session) : undefined;
      cookiesJson = minted.cookies ? JSON.stringify(minted.cookies) : undefined;
    }
  }

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

/**
 * Renvoie l'ID de l'utilisateur de la session injectée ou générée
 * (mêmes sources que restoreSupabaseSession).
 */
export function getSessionUserId(): string {
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (sessionJson) {
    return (JSON.parse(sessionJson) as { user: { id: string } }).user.id;
  }
  const sessionFile = join(homedir(), ".cache/lovable-auth/session.json");
  if (existsSync(sessionFile)) {
    const minted = JSON.parse(readFileSync(sessionFile, "utf-8")) as {
      session?: { user?: { id?: string } };
    };
    const id = minted.session?.user?.id;
    if (id) return id;
  }
  throw new Error(
    "Session Supabase absente. Connectez-vous dans le preview Lovable puis relancez les tests.",
  );
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante: ${name}`);
  return value;
}
