// Shared Stripe helpers for the two-account setup (Conches / Beaumont).
// Direct fetch against api.stripe.com (works with rk_live restricted keys,
// no npm stripe SDK needed).

export type StripeSite = 'conches' | 'beaumont';

export function resolveSite(value: unknown): StripeSite {
  return value === 'beaumont' ? 'beaumont' : 'conches';
}

export function siteFromRestaurant(restaurant: string | null | undefined): StripeSite {
  return (restaurant ?? '').toLowerCase().includes('beaumont') ? 'beaumont' : 'conches';
}

export function stripeSecretKey(site: StripeSite): string {
  const key = Deno.env.get(site === 'beaumont' ? 'STRIPE_SECRET_KEY_BEAUMONT' : 'STRIPE_SECRET_KEY_CONCHES');
  if (!key) throw new Error(`Clé Stripe manquante pour le site ${site}`);
  return key;
}

export function stripePublicKey(site: StripeSite): string {
  const key = Deno.env.get(site === 'beaumont' ? 'STRIPE_PUBLIC_KEY_BEAUMONT' : 'STRIPE_PUBLIC_KEY_CONCHES');
  if (!key) throw new Error(`Clé publique Stripe manquante pour le site ${site}`);
  return key;
}

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripeRequest(
  site: StripeSite,
  path: string,
  method: 'GET' | 'POST',
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey(site)}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function createPaymentIntent(
  site: StripeSite,
  opts: { amountCents: number; orderId: string; orderType: string },
): Promise<Record<string, unknown>> {
  return stripeRequest(site, '/payment_intents', 'POST', {
    amount: String(opts.amountCents),
    currency: 'eur',
    capture_method: 'manual',
    'metadata[order_id]': opts.orderId,
    'metadata[site]': site,
    'metadata[order_type]': opts.orderType,
    // Automatic payment methods : active CB + Apple Pay + Google Pay
    // (les wallets s'affichent automatiquement dans le PaymentElement
    //  selon l'appareil/navigateur du client).
    'automatic_payment_methods[enabled]': 'true',
  });
}

export async function capturePaymentIntent(site: StripeSite, paymentIntentId: string): Promise<Record<string, unknown>> {
  return stripeRequest(site, `/payment_intents/${paymentIntentId}/capture`, 'POST', {});
}

export async function cancelPaymentIntent(site: StripeSite, paymentIntentId: string): Promise<Record<string, unknown>> {
  return stripeRequest(site, `/payment_intents/${paymentIntentId}/cancel`, 'POST', {});
}

export async function retrievePaymentIntent(site: StripeSite, paymentIntentId: string): Promise<Record<string, unknown>> {
  return stripeRequest(site, `/payment_intents/${paymentIntentId}`, 'GET');
}

/** Capture idempotente et tolérante aux états Stripe.
 *  Renvoie l'état final ('captured' | 'cancelled') ou lève une erreur explicite en français. */
export async function captureIfNeeded(
  site: StripeSite,
  paymentIntentId: string,
): Promise<'captured' | 'cancelled'> {
  const pi = await retrievePaymentIntent(site, paymentIntentId);
  const status = String(pi.status ?? '');

  switch (status) {
    case 'succeeded':
      return 'captured';
    case 'requires_capture':
      await capturePaymentIntent(site, paymentIntentId);
      return 'captured';
    case 'canceled':
      throw new Error("La pré-autorisation Stripe a déjà été annulée : le paiement ne peut plus être encaissé.");
    case 'processing':
      throw new Error('Le paiement est encore en cours de traitement chez Stripe, réessayez dans quelques secondes.');
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      throw new Error("Le paiement du client n'est pas encore autorisé : la commande ne peut pas être encaissée.");
    default:
      throw new Error(`État Stripe inattendu (${status}) : encaissement impossible.`);
  }
}



// --- Webhook signature verification (v1, HMAC-SHA256) ---

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
): Promise<Record<string, unknown>> {
  if (!signatureHeader) throw new Error('Signature Stripe manquante');

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) throw new Error('Signature Stripe invalide');

  const ts = parseInt(timestamp, 10);
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSeconds) {
    throw new Error('Signature Stripe expirée');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signedPayload = `${timestamp}.${rawBody}`;
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = bytesToHex(new Uint8Array(sig));

  if (!signatures.includes(expected)) throw new Error('Signature Stripe non conforme');

  return JSON.parse(rawBody);
}

// --- Payment method domains (Apple Pay / Google Pay) ---
// Apple Pay ne s'affiche que si le domaine est enregistré sur le compte Stripe.

export async function listPaymentMethodDomains(site: StripeSite): Promise<Record<string, unknown>> {
  return stripeRequest(site, '/payment_method_domains?limit=100', 'GET');
}

export async function registerPaymentMethodDomain(
  site: StripeSite,
  domainName: string,
): Promise<Record<string, unknown>> {
  return stripeRequest(site, '/payment_method_domains', 'POST', {
    domain_name: domainName,
    enabled: 'true',
  });
}

export async function validatePaymentMethodDomain(
  site: StripeSite,
  domainId: string,
): Promise<Record<string, unknown>> {
  return stripeRequest(site, `/payment_method_domains/${domainId}/validate`, 'POST', {});
}
