import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase pour les tests E2E — utilise la clé service_role si
 * disponible (E2E_SUPABASE_SERVICE_ROLE_KEY) pour pouvoir lire la fiche
 * client côté admin sans dépendre des politiques RLS.
 *
 * Sinon, retombe sur la clé anon (les vérifications côté DB doivent alors
 * être compatibles avec les RLS de l'utilisateur connecté).
 */
export function getSupabaseAdmin(): SupabaseClient {
  const url =
    process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.E2E_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || (!serviceKey && !anonKey)) {
    throw new Error(
      "Config Supabase manquante pour les tests E2E (E2E_SUPABASE_URL + clé).",
    );
  }

  return createClient(url, serviceKey ?? anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client Supabase authentifié avec la session utilisateur injectée
 * (LOVABLE_BROWSER_SUPABASE_SESSION_JSON) ou générée via
 * `lovable auth-session` (~/.cache/lovable-auth/session.json).
 */
export function getSupabaseUserClient(): SupabaseClient {
  const url =
    process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.E2E_SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Config Supabase manquante pour les tests E2E (E2E_SUPABASE_URL + clé).",
    );
  }

  let sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!sessionJson) {
    const sessionFile = join(homedir(), ".cache/lovable-auth/session.json");
    if (existsSync(sessionFile)) {
      const minted = JSON.parse(readFileSync(sessionFile, "utf-8")) as {
        session?: unknown;
      };
      sessionJson = minted.session ? JSON.stringify(minted.session) : undefined;
    }
  }
  if (!sessionJson) {
    throw new Error("Session Supabase absente pour le client utilisateur.");
  }
  const session = JSON.parse(sessionJson) as {
    access_token: string;
    refresh_token: string;
  };

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Pose la session sur le client pour que les requêtes passent les RLS
  // de l'utilisateur connecté.
  void client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return client;
}
