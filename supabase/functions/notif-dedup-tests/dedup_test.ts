// Integration tests for push-notification deduplication.
//
// Push notifications are sent by a database trigger (`send_push_on_notification`)
// for every row inserted into `public.notifications`. Therefore, "no duplicate
// push" is guaranteed at the source by ensuring no duplicate `notifications`
// row is ever created for the same logical event. Each chat / delivery event
// carries a unique `dedupe_key`, backed by `notifications_dedupe_key_uidx`.
//
// These tests verify:
//   1. The unique `dedupe_key` constraint exists and blocks a second row.
//   2. A restaurant chat reply produces exactly ONE customer notification, and
//      re-emitting the same event (same dedupe_key) does not add a second one.
//   3. A delivery-time proposal produces exactly ONE notification per proposed
//      estimate, even when the same estimate is proposed again.
//
// All tests require the service-role key (to seed users / bypass RLS while
// seeding). They are skipped automatically when it is not available.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const HAS_SERVICE_ROLE = Boolean(SERVICE_ROLE_KEY);

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createTestUser(
  admin: SupabaseClient,
  label: string,
): Promise<string> {
  const email = `dedup-test-${label}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Pw!${crypto.randomUUID()}`,
    email_confirm: true,
    user_metadata: { first_name: "Dedup", last_name: label },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return data.user.id;
}

async function cleanupUser(admin: SupabaseClient, userId: string) {
  await admin.from("notifications").delete().eq("user_id", userId);
  await admin.from("orders").delete().eq("user_id", userId);
  await admin.from("chat_conversations").delete().eq("customer_id", userId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

// ---------------------------------------------------------------------------
// 1. The dedupe_key unique constraint blocks a duplicate row.
// ---------------------------------------------------------------------------

Deno.test({
  name: "duplicate dedupe_key cannot create a second notification",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const user = await createTestUser(admin, "uniq");
    const dedupe = `test_event:${crypto.randomUUID()}`;
    try {
      const row = {
        user_id: user,
        title: "Test",
        body: "Body",
        type: "new_message",
        site: "conches",
        dedupe_key: dedupe,
      };

      const { error: firstErr } = await admin.from("notifications").insert(row);
      assertEquals(firstErr, null, "first insert with a fresh dedupe_key succeeds");

      // Second insert with the same dedupe_key must be rejected (unique index).
      const { error: secondErr } = await admin.from("notifications").insert(row);
      assert(secondErr, "second insert with the same dedupe_key must fail");

      const { count } = await admin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("dedupe_key", dedupe);
      assertEquals(count, 1, "exactly one notification exists for the dedupe_key");
    } finally {
      await cleanupUser(admin, user);
    }
  },
});

// ---------------------------------------------------------------------------
// 2. A restaurant chat reply yields exactly one customer notification.
// ---------------------------------------------------------------------------

Deno.test({
  name: "chat reply produces a single, non-duplicable notification",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "chat");
    try {
      const { data: convo, error: convoErr } = await admin
        .from("chat_conversations")
        .insert({ customer_id: customer, site: "conches" })
        .select()
        .single();
      assertEquals(convoErr, null, "conversation created");

      // Admin reply -> trigger notify_customer_chat_reply inserts ONE row.
      const { data: msg, error: msgErr } = await admin
        .from("chat_messages")
        .insert({
          conversation_id: convo!.id,
          sender_id: customer, // any uuid; sender_type drives the trigger
          sender_type: "admin",
          content: "Bonjour, votre commande arrive !",
          site: "conches",
        })
        .select()
        .single();
      assertEquals(msgErr, null, "admin message created");

      const expectedKey = `chat_reply:${msg!.id}`;
      const { count: afterReply } = await admin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", customer)
        .eq("dedupe_key", expectedKey);
      assertEquals(afterReply, 1, "exactly one notification for the reply");

      // Re-emitting the SAME event (same dedupe_key) must not add another.
      const { error: dupErr } = await admin.from("notifications").insert({
        user_id: customer,
        title: "Nouvelle réponse du restaurant",
        body: "duplicate attempt",
        type: "new_message",
        reference_id: convo!.id,
        site: "conches",
        dedupe_key: expectedKey,
      });
      assert(dupErr, "duplicate chat-reply notification must be rejected");

      const { count: finalCount } = await admin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("dedupe_key", expectedKey);
      assertEquals(finalCount, 1, "still a single chat-reply notification");
    } finally {
      await cleanupUser(admin, customer);
    }
  },
});

// ---------------------------------------------------------------------------
// 3. A delivery-time proposal yields one notification per estimate.
// ---------------------------------------------------------------------------

Deno.test({
  name: "delivery estimate proposal is not notified twice for the same time",
  ignore: !HAS_SERVICE_ROLE,
  fn: async () => {
    const admin = serviceClient();
    const customer = await createTestUser(admin, "deliv");
    try {
      const { data: order, error: orderErr } = await admin
        .from("orders")
        .insert({
          user_id: customer,
          restaurant: "Pizza Conches",
          order_type: "livraison",
          items: [{ name: "Margherita", qty: 1 }],
          total_price: 18,
        })
        .select()
        .single();
      assertEquals(orderErr, null, "delivery order created");

      // Propose 19:30 -> one notification.
      await admin
        .from("orders")
        .update({ delivery_estimate: "19:30", delivery_response: null })
        .eq("id", order!.id);

      // Change to 20:00 -> a different, legitimate notification.
      await admin
        .from("orders")
        .update({ delivery_estimate: "20:00", delivery_response: null })
        .eq("id", order!.id);

      // Propose 19:30 again -> same dedupe_key, must NOT create a duplicate.
      await admin
        .from("orders")
        .update({ delivery_estimate: "19:30", delivery_response: null })
        .eq("id", order!.id);

      const key1930 = `delivery_estimate:${order!.id}:19:30`;
      const { count: count1930 } = await admin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("dedupe_key", key1930);
      assertEquals(count1930, 1, "19:30 estimate notified exactly once");

      const { count: total } = await admin
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", customer)
        .eq("reference_id", order!.id)
        .eq("title", "Horaire de livraison proposé");
      assertEquals(total, 2, "only the two distinct estimates are notified");
    } finally {
      await cleanupUser(admin, customer);
    }
  },
});
