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

      // Delivery-proposal response goes through the respond-to-delivery-time
      // edge function only; a direct write is refused.
      const { error: respErr } = await customer.client
        .from("orders")
        .update({ delivery_response: "accepted" })
        .eq("id", inserted.id);
      assert(respErr, "customer must not write delivery_response directly");

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

// ---------------------------------------------------------------------------
// Delivery time proposed by the site admin must be immutable for the customer
// ---------------------------------------------------------------------------

Deno.test("anon cannot modify a proposed delivery time via the API", async () => {
  const sb = anonClient();
  const { data, error } = await sb
    .from("orders")
    .update({ delivery_time_proposed: new Date().toISOString() })
    .not("id", "is", null)
    .select("id");
  assert(error || !data || data.length === 0, "anon must not update any order");
});

Deno.test({
  name: "customer cannot modify the delivery time proposed by the admin (direct API)",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "proposal");
    try {
      const requested = new Date(Date.now() + 60 * 60_000).toISOString();
      const proposed = new Date(Date.now() + 90 * 60_000).toISOString();

      // Seed a delivery order carrying an admin proposal (service role).
      const { data: order, error: seedErr } = await admin
        .from("orders")
        .insert({
          ...baseOrder(customer.id),
          order_type: "delivery",
          delivery_address: { street: "1 rue Test", city: "Conches", postal_code: "27190" },
          delivery_time_requested: requested,
          delivery_time_proposed: proposed,
          delivery_estimate: "20:30",
        })
        .select()
        .single();
      assertEquals(seedErr, null, `seed failed: ${seedErr?.message}`);

      const tampered = new Date(Date.now() + 10 * 60_000).toISOString();
      const attempts: Record<string, unknown>[] = [
        { delivery_time_proposed: tampered },
        { delivery_time_proposed: null },
        { delivery_time_confirmed: tampered },
        { delivery_time_requested: tampered },
        { delivery_estimate: "18:00" },
        { delivery_response: "accepted", delivery_time_confirmed: tampered },
        { delivery_time_proposed: tampered, status: "cancelled" },
      ];
      for (const patch of attempts) {
        const { error } = await customer.client
          .from("orders")
          .update(patch)
          .eq("id", order.id);
        assert(error, `customer patch must be rejected: ${JSON.stringify(patch)}`);
      }

      // Raw REST call (bypassing supabase-js) is rejected too.
      const token = (customer.client as unknown as { rest: { headers: Record<string, string> } })
        .rest.headers["Authorization"];
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: ANON_KEY,
            Authorization: token,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ delivery_time_proposed: tampered }),
        },
      );
      const body = await res.text();
      assert(!res.ok, `raw PATCH must fail, got ${res.status}: ${body}`);

      // Value in the database is unchanged.
      const { data: after } = await admin
        .from("orders")
        .select("delivery_time_proposed, delivery_time_confirmed, delivery_time_requested, delivery_response, delivery_estimate")
        .eq("id", order.id)
        .single();
      assertEquals(new Date(after!.delivery_time_proposed).toISOString(), proposed);
      assertEquals(new Date(after!.delivery_time_requested).toISOString(), requested);
      assertEquals(after!.delivery_time_confirmed, null);
      assertEquals(after!.delivery_response, null);
      assertEquals(after!.delivery_estimate, "20:30");
    } finally {
      await cleanupUser(admin, customer.id);
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

// ---------------------------------------------------------------------------
// Business rule: at most 1 `super_admin` and 2 `secondary_super_admin`.
// Enforced server-side by triggers on `admin_phones` and `user_roles`, so the
// limit holds even when the UI is bypassed (direct API/table writes).
// ---------------------------------------------------------------------------

Deno.test({
  name: "super admin limits cannot be bypassed outside the UI",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const users: string[] = [];
    const phones: string[] = [];

    const uniquePhone = () =>
      `+3399${Math.floor(100000 + Math.random() * 899999)}`;

    try {
      // --- super_admin: only one allowed -----------------------------------
      const { count: superCount } = await admin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin");

      const extra = await createTestUser(admin, "superdupe");
      users.push(extra.id);

      if ((superCount ?? 0) >= 1) {
        // Direct write on user_roles (bypasses admin_phones entirely).
        const { error: roleErr } = await admin
          .from("user_roles")
          .insert({ user_id: extra.id, role: "super_admin" });
        assert(roleErr, "a second super_admin must be rejected in user_roles");

        // Direct write on admin_phones (bypasses the client-side check).
        const phone = uniquePhone();
        const { error: phoneErr } = await admin
          .from("admin_phones")
          .insert({ phone, role: "super_admin" });
        if (!phoneErr) phones.push(phone);
        assert(phoneErr, "a second super_admin must be rejected in admin_phones");
      }

      // --- secondary_super_admin: at most two -------------------------------
      const seeded: string[] = [];
      const { count: secCount } = await admin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "secondary_super_admin");

      for (let i = (secCount ?? 0); i < 2; i++) {
        const u = await createTestUser(admin, `secsuper${i}`);
        users.push(u.id);
        const { error } = await admin
          .from("user_roles")
          .insert({ user_id: u.id, role: "secondary_super_admin" });
        assertEquals(error, null, "seeding secondary super admins should work");
        seeded.push(u.id);
      }

      const third = await createTestUser(admin, "secsuper3");
      users.push(third.id);

      const { error: thirdRoleErr } = await admin
        .from("user_roles")
        .insert({ user_id: third.id, role: "secondary_super_admin" });
      assert(
        thirdRoleErr,
        "a third secondary_super_admin must be rejected in user_roles",
      );

      const thirdPhone = uniquePhone();
      const { error: thirdPhoneErr } = await admin
        .from("admin_phones")
        .insert({ phone: thirdPhone, role: "secondary_super_admin" });
      if (!thirdPhoneErr) phones.push(thirdPhone);
      assert(
        thirdPhoneErr,
        "a third secondary_super_admin must be rejected in admin_phones",
      );

      // --- non-regression: unrestricted roles still work --------------------
      const { error: okErr } = await admin
        .from("user_roles")
        .insert({ user_id: third.id, role: "secondary_admin_conches" });
      assertEquals(okErr, null, "unrestricted roles must still be assignable");
    } finally {
      for (const p of phones) {
        await admin.from("admin_phones").delete().eq("phone", p);
      }
      for (const id of users) {
        await cleanupUser(admin, id);
      }
    }
  },
});
