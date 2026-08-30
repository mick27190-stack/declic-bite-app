import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { supabase } from '@/integrations/supabase/client';

export type StripeSite = 'conches' | 'beaumont';

// Une instance Stripe par site : Conches et Beaumont ont deux comptes distincts.
const cache = new Map<StripeSite, Promise<Stripe | null>>();

export function resolveStripeSite(value: string | null | undefined): StripeSite {
  return (value ?? '').toLowerCase().includes('beaumont') ? 'beaumont' : 'conches';
}

export function getStripe(site: StripeSite): Promise<Stripe | null> {
  const cached = cache.get(site);
  if (cached) return cached;

  const promise = (async () => {
    const { data, error } = await supabase.functions.invoke('stripe-config', {
      method: 'GET',
      body: undefined,
      headers: {},
      // La fonction lit le site en query string.
    });
    // supabase-js ne permet pas de query params sur invoke : fallback fetch direct.
    if (error || !data?.publishable_key) {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-config?site=${site}`;
      const res = await fetch(url, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const json = await res.json();
      if (!res.ok || !json.publishable_key) {
        throw new Error(json.error ?? 'Configuration de paiement indisponible');
      }
      return loadStripe(json.publishable_key);
    }
    return loadStripe(data.publishable_key);
  })();

  cache.set(site, promise);
  return promise;
}
