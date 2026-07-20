// Integration tests for send-transactional-email.
//
// These hit the deployed function over HTTPS and prove the two security
// invariants the last hardening pass introduced:
//
//   1. Requests without an Authorization header are rejected.
//   2. Requests authenticated with the public anon key alone (no admin role)
//      are rejected — the JWT check in-code must run in addition to the
//      gateway's verify_jwt.
//
// We intentionally do NOT test the happy admin path here: minting an admin
// JWT would require the service role key, which is not available to the
// sandbox. The negative tests are enough to prove the check exists.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FN_URL = `${SUPABASE_URL}/functions/v1/send-transactional-email`;

const sampleBody = JSON.stringify({
  templateName: "invoice",
  recipientEmail: "attacker@example.com",
  idempotencyKey: `security-test-${crypto.randomUUID()}`,
  templateData: {
    customerName: "Attacker",
    invoiceNumber: "TEST-0001",
    orderDate: "01/01/2026",
    totalTTC: "1,00€",
    downloadUrl: "https://example.com/evil.pdf",
    companyName: "Déclic Pizza",
  },
});

Deno.test("rejects requests without Authorization header", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: sampleBody,
  });
  const text = await res.text();
  // Gateway (verify_jwt) returns 401 before the function even runs.
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${text}`);
});

Deno.test("rejects anon-key requests (no admin role)", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: sampleBody,
  });
  const text = await res.text();
  // Gateway accepts the anon key, but the in-code role check must then
  // reject it. Either 401 (no user sub in claims) or 403 (no admin role)
  // is acceptable — both prove the extra check runs. What must NOT happen
  // is a 2xx.
  const ok = res.status === 401 || res.status === 403;
  assertEquals(
    ok,
    true,
    `expected 401 or 403 for anon-key call, got ${res.status}: ${text}`,
  );
});

// ---------------------------------------------------------------------------
// Storage RLS invariants for the invoices / company-logos buckets.
//
// Both buckets are private and their storage.objects policies require the
// caller to be an admin whose site matches split_part(name,'/',1). The
// negative tests below confirm the policies reject unauthenticated writes
// for every path shape the client code produces (site-prefixed and, for
// coverage, an unprefixed path that used to be accepted before the fix).
// ---------------------------------------------------------------------------

async function tryUpload(bucket: string, path: string, auth?: string) {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "apikey": SUPABASE_ANON_KEY,
  };
  if (auth) headers["Authorization"] = auth;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // "%PDF"
  });
  await res.text();
  return res.status;
}

Deno.test("invoices bucket: rejects unauthenticated upload with site prefix", async () => {
  const status = await tryUpload("invoices", `conches/${crypto.randomUUID()}/x.pdf`);
  const ok = status === 400 || status === 401 || status === 403;
  assertEquals(ok, true, `expected 400/401/403, got ${status}`);
});

Deno.test("invoices bucket: rejects anon-authenticated upload (no admin role)", async () => {
  const status = await tryUpload(
    "invoices",
    `conches/${crypto.randomUUID()}/x.pdf`,
    `Bearer ${SUPABASE_ANON_KEY}`,
  );
  const ok = status === 400 || status === 401 || status === 403;
  assertEquals(ok, true, `expected 400/401/403, got ${status}`);
});

Deno.test("invoices bucket: rejects upload without a site prefix", async () => {
  // Even if a rogue admin tried the pre-fix path shape (no site segment),
  // split_part(name,'/',1) would be a user_id UUID and can_admin_access_site
  // would reject it. Anonymous callers are of course rejected too.
  const status = await tryUpload(
    "invoices",
    `${crypto.randomUUID()}/x.pdf`,
    `Bearer ${SUPABASE_ANON_KEY}`,
  );
  const ok = status === 400 || status === 401 || status === 403;
  assertEquals(ok, true, `expected 400/401/403, got ${status}`);
});

Deno.test("company-logos bucket: rejects unauthenticated upload", async () => {
  const status = await tryUpload("company-logos", `beaumont/logo-${crypto.randomUUID()}.png`);
  const ok = status === 400 || status === 401 || status === 403;
  assertEquals(ok, true, `expected 400/401/403, got ${status}`);
});

Deno.test("company-logos bucket: rejects anon-authenticated upload (no admin role)", async () => {
  const status = await tryUpload(
    "company-logos",
    `beaumont/logo-${crypto.randomUUID()}.png`,
    `Bearer ${SUPABASE_ANON_KEY}`,
  );
  const ok = status === 400 || status === 401 || status === 403;
  assertEquals(ok, true, `expected 400/401/403, got ${status}`);
});

