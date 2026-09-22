// Tests de bout en bout du lien « Stop » des SMS promotionnels.
//
// Objectif : vérifier qu'un token valide permet, SANS aucune authentification
// (header `apikey` seul, pas de bearer token), de :
//   1. consulter la validité du lien (GET)
//   2. modifier le consentement (POST) -> consentements + sms_opt_outs
//   3. ne pas rejouer une désinscription déjà effectuée
//
// Les tests qui ont besoin de semer un token utilisent la service-role key.
// Sans elle dans l'environnement, ils sont automatiquement ignorés et seules
// les vérifications d'accès sans authentification tournent.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const HAS_SERVICE_ROLE = Boolean(SERVICE_ROLE_KEY);
const FN_URL = `${SUPABASE_URL}/functions/v1/handle-sms-unsubscribe`;

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Appel du endpoint public : aucun bearer token, uniquement l'apikey. */
async function callUnsubscribe(
  method: "GET" | "POST",
  token: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const init: RequestInit = { method, headers: { apikey: ANON_KEY } };
  let url = FN_URL;
  if (method === "GET") {
    url += `?token=${encodeURIComponent(token)}`;
  } else {
    init.headers = { ...init.headers, "Content-Type": "application/json" };
    init.body = JSON.stringify({ token });
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

interface Seed {
  token: string;
  phone: string;
  userId: string;
  email: string;
}

async function seedTokenWithUser(admin: SupabaseClient): Promise<Seed> {
  const email = `sms-unsub-test-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Pw!${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { first_name: "SMS", last_name: "Unsub" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  // Numéro fictif hors plage réelle, pour ne toucher aucun client existant.
  const phone = `+339${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const token = crypto.randomUUID();
  const { error: insertError } = await admin.from("sms_unsubscribe_tokens").insert({
    token,
    phone,
    user_id: data.user.id,
  });
  if (insertError) throw new Error(`token seed failed: ${insertError.message}`);

  return { token, phone, userId: data.user.id, email };
}

async function cleanup(admin: SupabaseClient, seed: Seed) {
  await admin.from("consentements").delete().eq("client_id", seed.userId);
  await admin.from("sms_opt_outs").delete().eq("phone", seed.phone);
  await admin.from("sms_unsubscribe_tokens").delete().eq("token", seed.token);
  await admin.auth.admin.deleteUser(seed.userId);
}

Deno.test("lien Stop invalide : 404 sans authentification (pas de 401)", async () => {
  const { status, body } = await callUnsubscribe("GET", crypto.randomUUID());
  assertEquals(status, 404, `réponse inattendue: ${JSON.stringify(body)}`);
  assertEquals(body.error, "Invalid or expired token");
});

Deno.test("lien Stop sans token : 400 sans authentification", async () => {
  const res = await fetch(FN_URL, { method: "GET", headers: { apikey: ANON_KEY } });
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error, "Token is required");
});

Deno.test({
  name: "lien Stop valide : consultation puis modification du consentement sans auth",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const seed = await seedTokenWithUser(admin);
    try {
      // 1. Consultation du lien (GET) : le lien est valide.
      const get = await callUnsubscribe("GET", seed.token);
      assertEquals(get.status, 200, JSON.stringify(get.body));
      assertEquals(get.body.valid, true);

      // Rien n'est encore modifié par une simple consultation.
      const { data: beforeConsents } = await admin
        .from("consentements")
        .select("id")
        .eq("client_id", seed.userId);
      assertEquals(beforeConsents?.length ?? 0, 0);

      // 2. Confirmation de la désinscription (POST).
      const post = await callUnsubscribe("POST", seed.token);
      assertEquals(post.status, 200, JSON.stringify(post.body));
      assertEquals(post.body.success, true);

      // 3. Consentement SMS marketing enregistré en refus (nouvelle ligne).
      const { data: consents } = await admin
        .from("consentements")
        .select("type_consentement, accepte, motif_refus")
        .eq("client_id", seed.userId);
      assertEquals(consents?.length, 1);
      assertEquals(consents?.[0].type_consentement, "sms_marketing");
      assertEquals(consents?.[0].accepte, false);
      assert(
        typeof consents?.[0].motif_refus === "string" &&
          consents[0].motif_refus.length > 0,
        "motif de refus attendu",
      );

      // 4. Opt-out enregistré au niveau du numéro.
      const { data: optOut } = await admin
        .from("sms_opt_outs")
        .select("phone")
        .eq("phone", seed.phone)
        .maybeSingle();
      assertEquals(optOut?.phone, seed.phone);

      // 5. Token consommé.
      const { data: tokenRow } = await admin
        .from("sms_unsubscribe_tokens")
        .select("used_at")
        .eq("token", seed.token)
        .maybeSingle();
      assert(tokenRow?.used_at, "used_at doit être renseigné");
    } finally {
      await cleanup(admin, seed);
    }
  },
});

Deno.test({
  name: "lien Stop déjà utilisé : pas de double désinscription",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const seed = await seedTokenWithUser(admin);
    try {
      const first = await callUnsubscribe("POST", seed.token);
      assertEquals(first.body.success, true);

      const second = await callUnsubscribe("POST", seed.token);
      assertEquals(second.status, 200, JSON.stringify(second.body));
      assertEquals(second.body.reason, "already_unsubscribed");

      const get = await callUnsubscribe("GET", seed.token);
      assertEquals(get.body.valid, false);
      assertEquals(get.body.reason, "already_unsubscribed");

      // Une seule ligne de consentement, l'historique n'est pas dupliqué.
      const { data: consents } = await admin
        .from("consentements")
        .select("id")
        .eq("client_id", seed.userId);
      assertEquals(consents?.length, 1);
    } finally {
      await cleanup(admin, seed);
    }
  },
});
