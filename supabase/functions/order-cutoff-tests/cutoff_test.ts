// Backend unit tests for the order-cut-off rules enforced at insert time.
//
// The trigger `enforce_order_creation_open` delegates its time-based checks
// to the pure SQL function `public.check_order_creation_cutoff(order_type,
// pickup_time, paris_minutes)`. Testing that function directly lets us pin
// the exact Paris "now" and cover the 21h15 / 21h16 / 21h30 / 21h31 borders
// without depending on wall-clock time or on RLS.
//
// The tests only need the anon key (no user is signed in) since the helper
// is granted EXECUTE to anon/authenticated/service_role.
//
// Run with:
//   deno test --allow-env --allow-net supabase/functions/order-cutoff-tests

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

function anon(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Call the pure cut-off validator. Returns `{ ok: true }` when the function
 * accepts the input (RPC returns null for `void`), or `{ ok: false, message }`
 * when Postgres raised — the trigger would refuse the insert in that case.
 */
async function callCutoff(
  orderType: "emporter" | "livraison",
  pickupTime: string | null,
  parisMinutes: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sb = anon();
  const { error } = await sb.rpc("check_order_creation_cutoff", {
    _order_type: orderType,
    _pickup_time: pickupTime,
    _paris_minutes: parisMinutes,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

const m = (h: number, min: number) => h * 60 + min;

// ---------------------------------------------------------------------------
// LIVRAISON — 21h17 boundary (last order accepted at 21h16)
// ---------------------------------------------------------------------------

Deno.test("livraison: 21h15 Paris → still accepted with a valid slot", async () => {
  // At 21h15 the earliest reachable slot is 21h15 + 45 = 22h00.
  const r = await callCutoff("livraison", "22:00", m(21, 15));
  assertEquals(r.ok, true, `should accept at 21h15, got: ${(!r.ok && r.message) || ""}`);
});

Deno.test("livraison: 21h16 Paris → still accepted on the 22h00 slot", async () => {
  const r = await callCutoff("livraison", "22:00", m(21, 16));
  assertEquals(r.ok, true, `should accept at 21h16, got: ${(!r.ok && r.message) || ""}`);
});

Deno.test("livraison: 21h17 Paris → refused by the cut-off", async () => {
  const r = await callCutoff("livraison", "22:00", m(21, 17));
  assert(!r.ok, "delivery must be blocked from 21h17");
  assert(
    r.message.includes("livraison ne sont plus acceptées"),
    `unexpected error: ${r.message}`,
  );
});

Deno.test("livraison: 21h30 Paris → still refused (already past 21h17)", async () => {
  const r = await callCutoff("livraison", "22:00", m(21, 30));
  assert(!r.ok, "delivery must remain blocked past 21h17");
});

Deno.test("livraison: 20h00 Paris with missing pickup_time → refused", async () => {
  const r = await callCutoff("livraison", null, m(20, 0));
  assert(!r.ok);
  assert(r.message.includes("créneau de livraison"), `got: ${r.message}`);
});

Deno.test("livraison: 20h00 Paris with malformed pickup_time → refused", async () => {
  const r = await callCutoff("livraison", "20h30", m(20, 0));
  assert(!r.ok);
});

Deno.test("livraison: 20h00 Paris with out-of-window slot (22h15) → refused", async () => {
  const r = await callCutoff("livraison", "22:15", m(20, 0));
  assert(!r.ok);
  assert(r.message.includes("Créneau de livraison invalide"), `got: ${r.message}`);
});

Deno.test("livraison: 20h00 Paris with too-early slot (20h30) → refused (45 min lead)", async () => {
  // Earliest reachable at 20h00 = 20h00 + 45 = 20h45.
  const r = await callCutoff("livraison", "20:30", m(20, 0));
  assert(!r.ok, "slot before the 45 min lead must be refused");
});

Deno.test("livraison: 20h00 Paris with earliest valid slot (20h45) → accepted", async () => {
  const r = await callCutoff("livraison", "20:45", m(20, 0));
  assertEquals(r.ok, true);
});

Deno.test("livraison: grâce de 8 min — 20h08 accepte 20h45, 20h09 non", async () => {
  assertEquals((await callCutoff("livraison", "20:45", m(20, 8))).ok, true);
  assert(!(await callCutoff("livraison", "20:45", m(20, 9))).ok);
  assertEquals((await callCutoff("livraison", "21:00", m(20, 9))).ok, true);
});

Deno.test("livraison: 18h00 Paris with the very first slot (18h45) → accepted", async () => {
  const r = await callCutoff("livraison", "18:45", m(18, 0));
  assertEquals(r.ok, true);
});

Deno.test("livraison: 18h00 Paris with 18:30 → refused (never below the 18h45 first slot)", async () => {
  const r = await callCutoff("livraison", "18:30", m(18, 0));
  assert(!r.ok, "18:30 must never be accepted as a delivery slot");
  assert(r.message.includes("Créneau de livraison invalide"), `got: ${r.message}`);
});

Deno.test("livraison: no slot before 18:45 is ever accepted, whatever the Paris time", async () => {
  for (const slot of ["17:45", "18:00", "18:15", "18:30"]) {
    for (const now of [m(0, 0), m(17, 0), m(18, 0), m(18, 10), m(19, 0)]) {
      const r = await callCutoff("livraison", slot, now);
      assert(!r.ok, `slot ${slot} at ${now} min must be refused`);
    }
  }
});

Deno.test("livraison: 18h05/18h15 Paris → 18:45 still accepted (lead clamped to first slot)", async () => {
  assertEquals((await callCutoff("livraison", "18:45", m(18, 5))).ok, true);
  assertEquals((await callCutoff("livraison", "18:45", m(18, 15))).ok, true);
});

Deno.test("livraison: 18h20 Paris → 18:45 refused (lead pushes past the first slot)", async () => {
  // ceil((1100 + 30) / 15) * 15 = 1140 → 19:00.
  const r = await callCutoff("livraison", "18:45", m(18, 20));
  assert(!r.ok);
});


// ---------------------------------------------------------------------------
// EMPORTER — 21h16 last acceptance / 21h17 cut-off
// ---------------------------------------------------------------------------

Deno.test("emporter: 21h15 Paris → still accepted", async () => {
  const r = await callCutoff("emporter", null, m(21, 15));
  assertEquals(r.ok, true, `should accept take-away at 21h15`);
});

Deno.test("emporter: 21h16 Paris → still accepted (last acceptance minute)", async () => {
  const r = await callCutoff("emporter", null, m(21, 16));
  assertEquals(r.ok, true, `21h16 must remain within the take-away window`);
});

Deno.test("emporter: 21h17 Paris → refused by the cut-off", async () => {
  const r = await callCutoff("emporter", null, m(21, 17));
  assert(!r.ok, "take-away must be blocked from 21h17");
  assert(
    r.message.includes("à emporter ne sont plus acceptées"),
    `unexpected error: ${r.message}`,
  );
});

Deno.test("emporter: 21h30 Paris → refused (past the 21h17 cut-off)", async () => {
  const r = await callCutoff("emporter", null, m(21, 30));
  assert(!r.ok);
});

Deno.test("emporter: 22h00 Paris → still refused", async () => {
  const r = await callCutoff("emporter", null, m(22, 0));
  assert(!r.ok);
});

Deno.test("emporter: 18h30 Paris → accepted (no pickup_time required)", async () => {
  const r = await callCutoff("emporter", null, m(18, 30));
  assertEquals(r.ok, true);
});

// ---------------------------------------------------------------------------
// Cross-cut at 21h17 Paris: livraison closed, emporter still open.
// ---------------------------------------------------------------------------

Deno.test("cross-cut at 21h17: emporter open, livraison closed", async () => {
  const t = m(21, 17);
  const takeaway = await callCutoff("emporter", null, t);
  const delivery = await callCutoff("livraison", "22:00", t);
  assertEquals(takeaway.ok, true, "take-away must still accept at 21h17");
  assert(!delivery.ok, "delivery must be closed from 21h17");
});


// ---------------------------------------------------------------------------
// EMPORTER — pickup slot grid enforcement (18h45 → 21h30, 15 min steps).
// The API must apply the same rules as the client regardless of the device
// timezone: 18h30 is NEVER a valid take-away slot.
// ---------------------------------------------------------------------------

Deno.test("emporter: pickup_time 18:30 → refused (not on the 15-min grid)", async () => {
  const r = await callCutoff("emporter", "18:30", m(18, 0));
  assert(!r.ok, "18:30 must be rejected — it is not a valid take-away slot");
  assert(
    r.message.includes("Créneau à emporter invalide"),
    `unexpected error: ${r.message}`,
  );
});

Deno.test("emporter: pickup_time 18:45 at 18h00 Paris → accepted (first slot)", async () => {
  const r = await callCutoff("emporter", "18:45", m(18, 0));
  assertEquals(r.ok, true, `should accept 18:45 at 18h00, got: ${(!r.ok && r.message) || ""}`);
});

Deno.test("emporter: pickup_time 18:44 → refused (before first slot)", async () => {
  const r = await callCutoff("emporter", "18:44", m(18, 0));
  assert(!r.ok);
});

Deno.test("emporter: pickup_time 21:45 → refused (after last slot 21:30)", async () => {
  const r = await callCutoff("emporter", "21:45", m(19, 0));
  assert(!r.ok);
});

Deno.test("emporter: pickup_time 19:07 → refused (not on 15-min grid)", async () => {
  const r = await callCutoff("emporter", "19:07", m(18, 30));
  assert(!r.ok);
});

Deno.test("emporter: pickup_time 20:00 at 19h30 Paris → accepted (lead time OK)", async () => {
  const r = await callCutoff("emporter", "20:00", m(19, 30));
  assertEquals(r.ok, true);
});

Deno.test("emporter: pickup_time 19:00 at 18h50 Paris → refused (lead <15 min)", async () => {
  // earliest_allowed = ceil((18h50 + 15) / 15) * 15 = 19h15 → 19h00 too early.
  const r = await callCutoff("emporter", "19:00", m(18, 50));
  assert(!r.ok);
});

Deno.test("emporter: late window 21h15 Paris → only 21:30 slot allowed", async () => {
  const late = await callCutoff("emporter", "21:30", m(21, 15));
  assertEquals(late.ok, true);
  const others = await callCutoff("emporter", "21:15", m(21, 15));
  assert(!others.ok, "only the 21:30 slot may be booked in the late window");
});

Deno.test("emporter: malformed pickup_time → refused", async () => {
  const r = await callCutoff("emporter", "abc", m(19, 0));
  assert(!r.ok);
});
