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
