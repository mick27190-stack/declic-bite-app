// Backend integration tests: order creation must be refused whenever a
// closure ("fermeture du site") or an order block ("blocage des commandes")
// is active for the targeted site — including for direct REST/API inserts
// that bypass the UI entirely.
//
// The rule is enforced by the trigger `enforce_order_creation_open` on
// `public.orders`, which reads `public.active_site_closure_type(restaurant)`.
// Because the trigger runs before every insert, these tests write straight to
// the REST API (no frontend involved), which is exactly the bypass scenario.
//
// The tests need the service-role key to seed/cleanup closures and users.
// Without it they are skipped automatically.
//
// Run with:
//   deno test --allow-env --allow-net supabase/functions/closure-tests

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

const CONCHES = "Déclic Pizza - Conches";
const BEAUMONT = "Déclic Pizza - Beaumont";

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TestUser {
  id: string;
  token: string;
  client: SupabaseClient;
}

async function createTestUser(admin: SupabaseClient): Promise<TestUser> {
  const email = `closure-test-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Closure", last_name: "Test" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const { data: session, error: signInError } = await anonClient()
    .auth.signInWithPassword({ email, password });
  if (signInError || !session.session) {
    throw new Error(`signIn failed: ${signInError?.message}`);
  }
  const token = session.session.access_token;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { id: data.user.id, token, client };
}

async function cleanupUser(admin: SupabaseClient, userId: string) {
  await admin.from("orders").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

async function openClosure(
  admin: SupabaseClient,
  site: "conches" | "beaumont" | "all",
  closureType: "orders" | "site",
  createdBy: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await admin
    .from("restaurant_closures")
    .insert({
      site,
      closure_type: closureType,
      is_active: true,
      reason: "integration test",
      created_by: createdBy,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(`closure insert failed: ${error.message}`);
  return data!.id as string;
}

async function removeClosure(admin: SupabaseClient, id: string) {
  await admin.from("restaurant_closures").delete().eq("id", id);
}

function orderPayload(userId: string, restaurant: string) {
  return {
    user_id: userId,
    restaurant,
    order_type: "emporter",
    pickup_time: "20:00",
    status: "pending",
    total_price: 13.5,
    items: [
      {
        pizza: { id: "margherita", name: "Margherita", category: "classiques", basePrice: 0 },
        size: { id: "senior", name: "Senior", price: 0 },
        supplements: [],
        quantity: 1,
      },
    ],
  };
}

/**
 * Direct REST insert (no supabase-js helpers, no UI): the exact shape of a
 * hand-crafted API call an attacker/script would make.
 */
async function rawRestInsert(token: string, userId: string, restaurant: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(orderPayload(userId, restaurant)),
  });
  const body = await res.text();
  return { status: res.status, body };
}

async function insertOrder(user: TestUser, restaurant: string) {
  const { error } = await user.client
    .from("orders")
    .insert(orderPayload(user.id, restaurant));
  return error;
}

// ---------------------------------------------------------------------------
// active_site_closure_type — the helper the trigger relies on
// ---------------------------------------------------------------------------

Deno.test({
  name: "active_site_closure_type: reports the closure kind per site",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      const before = await admin.rpc("active_site_closure_type", { _restaurant: CONCHES });
      assertEquals(before.data, null, "no closure expected before the test seeds one");

      closureId = await openClosure(admin, "conches", "site", user.id);

      const conches = await admin.rpc("active_site_closure_type", { _restaurant: CONCHES });
      assertEquals(conches.data, "site");

      const beaumont = await admin.rpc("active_site_closure_type", { _restaurant: BEAUMONT });
      assertEquals(beaumont.data, null, "the other site must stay open");
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

// ---------------------------------------------------------------------------
// Order creation refused while a block / closure is active
// ---------------------------------------------------------------------------

Deno.test({
  name: "orders: refused when a 'blocage des commandes' is active on the site",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "conches", "orders", user.id);
      const error = await insertOrder(user, CONCHES);
      assert(error, "insert must be rejected while orders are blocked");
      assert(
        error!.message.includes("commandes sont actuellement bloquées"),
        `unexpected error: ${error!.message}`,
      );
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

Deno.test({
  name: "orders: refused with the closure message when the site is closed",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "conches", "site", user.id);
      const error = await insertOrder(user, CONCHES);
      assert(error, "insert must be rejected while the site is closed");
      assert(
        error!.message.includes("site est actuellement fermé"),
        `unexpected error: ${error!.message}`,
      );
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

Deno.test({
  name: "orders: a 'all' closure blocks both Conches and Beaumont",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "all", "site", user.id);
      for (const restaurant of [CONCHES, BEAUMONT]) {
        const error = await insertOrder(user, restaurant);
        assert(error, `insert must be rejected for ${restaurant}`);
        assert(
          error!.message.includes("site est actuellement fermé"),
          `unexpected error for ${restaurant}: ${error!.message}`,
        );
      }
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

Deno.test({
  name: "orders: a closure on one site does not block the other site",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "beaumont", "site", user.id);
      const error = await insertOrder(user, CONCHES);
      // Conches is open: the closure guard must not fire. Any error here can
      // only come from the opening-hours / cut-off rules, never from a closure.
      if (error) {
        assert(
          !error.message.includes("actuellement fermé") &&
            !error.message.includes("actuellement bloquées"),
          `Conches must not be blocked by a Beaumont closure: ${error.message}`,
        );
      }
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

// ---------------------------------------------------------------------------
// Bypassing the UI: raw REST call must be refused too
// ---------------------------------------------------------------------------

Deno.test({
  name: "orders: raw REST insert is refused while a closure is active (UI bypass)",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "conches", "site", user.id);
      const { status, body } = await rawRestInsert(user.token, user.id, CONCHES);
      assert(status >= 400, `raw REST insert must fail, got HTTP ${status}: ${body}`);
      assert(
        body.includes("actuellement fermé"),
        `unexpected REST error body: ${body}`,
      );

      const { count } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      assertEquals(count ?? 0, 0, "no order row may be persisted");
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

// ---------------------------------------------------------------------------
// Expired / inactive closures must not block anything
// ---------------------------------------------------------------------------

Deno.test({
  name: "orders: an expired closure (end_at in the past) no longer blocks",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "conches", "site", user.id, {
        end_at: new Date(Date.now() - 60_000).toISOString(),
      });
      const kind = await admin.rpc("active_site_closure_type", { _restaurant: CONCHES });
      assertEquals(kind.data, null, "an expired closure must not be reported as active");
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

Deno.test({
  name: "orders: an inactive closure (is_active = false) does not block",
  ignore: !HAS_SERVICE_ROLE,
  async fn() {
    const admin = serviceClient();
    const user = await createTestUser(admin);
    let closureId: string | null = null;
    try {
      closureId = await openClosure(admin, "conches", "site", user.id, {
        is_active: false,
      });
      const kind = await admin.rpc("active_site_closure_type", { _restaurant: CONCHES });
      assertEquals(kind.data, null, "an inactive closure must not be reported as active");
    } finally {
      if (closureId) await removeClosure(admin, closureId);
      await cleanupUser(admin, user.id);
    }
  },
});

// ---------------------------------------------------------------------------
// Smoke test that always runs (no service role needed)
// ---------------------------------------------------------------------------

Deno.test("anon cannot read or probe closures directly (RLS boundary)", async () => {
  const sb = anonClient();
  const { data, error } = await sb.from("restaurant_closures").select("id").limit(1);
  assert(error || (data ?? []).length === 0, "anon must not read closure rows");

  // The helper reads a RLS-protected table, so anon cannot probe it either;
  // the closure guard lives in the insert trigger, which runs as definer.
  const rpc = await sb.rpc("active_site_closure_type", { _restaurant: CONCHES });
  assert(rpc.error !== null, "anon must not be able to call the closure helper");
});
