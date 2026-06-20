// RLS integration tests for the critical tables `orders` and `user_roles`.
//
// These tests exercise the Row Level Security policies for three roles:
//   - anon              (not signed in)
//   - regular customer  (signed in, no admin role)
//   - admin             (signed in, super_admin role)
//
// NOTE: there is no `menu` table — the menu is static data in
// `src/data/pizzas.ts`, so it has no RLS surface to test.
//
// The authenticated-role tests need the service-role key to seed/cleanup test
// users. When it is not available in the environment, those tests are skipped
// automatically and only the anon boundary tests run.

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
  email: string;
  password: string;
  client: SupabaseClient;
}

async function createTestUser(
  admin: SupabaseClient,
  label: string,
): Promise<TestUser> {
  const email = `rls-test-${label}-${crypto.randomUUID()}@example.com`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "RLS", last_name: label },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  // Sign in to obtain an access token, then build a client bound to it.
  const signInClient = anonClient();
  const { data: session, error: signInError } =
    await signInClient.auth.signInWithPassword({ email, password });
  if (signInError || !session.session) {
    throw new Error(`signIn failed: ${signInError?.message}`);
  }
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    },
  });
  return { id: data.user.id, email, password, client };
}

async function cleanupUser(admin: SupabaseClient, userId: string) {
  await admin.from("orders").delete().eq("user_id", userId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

const baseOrder = (userId: string) => ({
  user_id: userId,
  restaurant: "Pizza Conches",
  order_type: "takeaway",
  items: [{ name: "Margherita", qty: 1 }],
  total_price: 12.5,
});

// ---------------------------------------------------------------------------
// ANON role — always runs (only needs the public anon key)
// ---------------------------------------------------------------------------

Deno.test("anon cannot read orders", async () => {
  const sb = anonClient();
  const { data, error } = await sb.from("orders").select("*").limit(1);
  // RLS returns no rows for anon (no matching policy), without leaking data.
  assert(!data || data.length === 0, "anon should not read any orders");
  assert(!error || error.code === "42501", "unexpected error shape");
});

Deno.test("anon cannot insert an order", async () => {
  const sb = anonClient();
  const { error } = await sb
    .from("orders")
    .insert(baseOrder(crypto.randomUUID()));
  assert(error, "anon insert into orders must be rejected by RLS");
});

Deno.test("anon cannot read user_roles", async () => {
  const sb = anonClient();
  const { data } = await sb.from("user_roles").select("*").limit(1);
  assert(!data || data.length === 0, "anon should not read user_roles");
});

Deno.test("anon cannot self-assign an admin role", async () => {
  const sb = anonClient();
  const { error } = await sb.from("user_roles").insert({
    user_id: crypto.randomUUID(),
    role: "secondary_admin_conches",
  });
  assert(error, "anon must not be able to insert into user_roles");
});

// ---------------------------------------------------------------------------
// AUTHENTICATED roles — require the service-role key to seed test users
// ---------------------------------------------------------------------------

Deno.test({
  name: "regular customer can only manage their own orders",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "customer");
    const other = await createTestUser(admin, "other");
    try {
      // Can insert an order for themselves.
      const { data: inserted, error: insErr } = await customer.client
        .from("orders")
        .insert(baseOrder(customer.id))
        .select()
        .single();
      assertEquals(insErr, null, "customer should insert their own order");
      assert(inserted, "inserted order returned");

      // Cannot insert an order on behalf of another user.
      const { error: spoofErr } = await customer.client
        .from("orders")
        .insert(baseOrder(other.id));
      assert(spoofErr, "customer must not insert orders for other users");

      // Can only see their own order, not the other user's.
      await admin.from("orders").insert(baseOrder(other.id));
      const { data: visible } = await customer.client.from("orders").select("*");
      assert(
        (visible ?? []).every((o) => o.user_id === customer.id),
        "customer must only see their own orders",
      );

      // Cannot tamper with protected columns (price/status) via the trigger.
      const { error: priceErr } = await customer.client
        .from("orders")
        .update({ total_price: 0.01 })
        .eq("id", inserted.id);
      assert(priceErr, "customer must not change total_price");

      const { error: statusErr } = await customer.client
        .from("orders")
        .update({ status: "completed" })
        .eq("id", inserted.id);
      assert(statusErr, "customer must not set status to completed");

      // Allowed: respond to delivery proposal.
      const { error: respErr } = await customer.client
        .from("orders")
        .update({ delivery_response: "accepted" })
        .eq("id", inserted.id);
      assertEquals(respErr, null, "customer may set delivery_response");

      // Allowed: cancel their own order.
      const { error: cancelErr } = await customer.client
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", inserted.id);
      assertEquals(cancelErr, null, "customer may cancel their own order");
    } finally {
      await cleanupUser(admin, customer.id);
      await cleanupUser(admin, other.id);
    }
  },
});

Deno.test({
  name: "regular customer cannot self-assign any role",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "norole");
    try {
      for (const role of [
        "secondary_admin_conches",
        "secondary_admin_beaumont",
        "site_admin_conches",
        "super_admin",
      ]) {
        const { error } = await customer.client
          .from("user_roles")
          .insert({ user_id: customer.id, role });
        assert(error, `customer must not self-assign role ${role}`);
      }
    } finally {
      await cleanupUser(admin, customer.id);
    }
  },
});

Deno.test({
  name: "admin can read all orders and update any order",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "ord");
    const adminUser = await createTestUser(admin, "admin");
    try {
      // Grant super_admin via service role (bypasses RLS by design).
      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: adminUser.id, role: "super_admin" });
      assertEquals(roleErr, null, "service role seeds admin role");

      const { data: order } = await admin
        .from("orders")
        .insert(baseOrder(customer.id))
        .select()
        .single();

      // Admin can see the customer's order.
      const { data: seen } = await adminUser.client
        .from("orders")
        .select("*")
        .eq("id", order!.id);
      assertEquals(seen?.length, 1, "admin should see all orders");

      // Admin can update protected fields (status).
      const { error: updErr } = await adminUser.client
        .from("orders")
        .update({ status: "preparing" })
        .eq("id", order!.id);
      assertEquals(updErr, null, "admin should update any order status");
    } finally {
      await cleanupUser(admin, customer.id);
      await cleanupUser(admin, adminUser.id);
    }
  },
});
