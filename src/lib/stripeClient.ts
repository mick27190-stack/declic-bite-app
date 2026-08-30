import { loadStripe, type Stripe } from '@stripe/stripe-js';

export type StripeSite = 'conches' | 'beaumont';

// Une instance Stripe par site : Conches et Beaumont ont deux comptes distincts,
// donc deux clés publiables différentes servies par l'edge function stripe-config.
const cache = new Map<StripeSite, Promise<Stripe | null>>();

export function resolveStripeSite(value: string | null | undefined): StripeSite {
  return (value ?? '').toLowerCase().includes('beaumont') ? 'beaumont' : 'conches';
}

export function getStripe(site: StripeSite): Promise<Stripe | null> {
  const cached = cache.get(site);
  if (cached) return cached;

  const promise = (async () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-config?site=${site}`;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const json = await res.json();
    if (!res.ok || !json.publishable_key) {
      throw new Error(json.error ?? 'Configuration de paiement indisponible');
    }
    return loadStripe(json.publishable_key);
  })();

  cache.set(site, promise);
  return promise;
}
