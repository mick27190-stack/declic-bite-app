/**
 * Source unique de vérité pour le prix unitaire d'une ligne de commande.
 *
 * Le backend (fonction SQL `compute_order_line_prices`) fait autorité : c'est
 * exactement la même fonction qui alimente `compute_order_total`, donc
 * l'affichage client, l'affichage admin, le ticket, la facture et le total
 * facturé ne peuvent plus diverger.
 *
 * Le calcul local n'est qu'un repli (offline / erreur réseau) et reproduit la
 * logique serveur.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPizzaSizePrice, getNonPizzaPrice } from '@/lib/pricing';
import { PIZZA_CATEGORIES } from '@/lib/promo';

export interface OrderLinePrice {
  /** Prix unitaire du produit, hors suppléments. */
  unitBase: number;
  /** Somme des suppléments pour une unité. */
  supplementsTotal: number;
  /** Prix unitaire tout compris (produit + suppléments). */
  unitPrice: number;
  /** Total de la ligne (prix unitaire × quantité). */
  lineTotal: number;
}

function supplementsOf(item: any): number {
  const sups = Array.isArray(item?.supplements) ? item.supplements : [];
  return sups.reduce((s: number, sup: any) => s + (sup?.price ?? 0), 0);
}

/** Repli local, aligné sur la fonction SQL `compute_order_line_prices`. */
export function computeLinePriceLocally(item: any, date: Date = new Date()): OrderLinePrice {
  const qty = item?.quantity ?? 1;
  const isPizza = PIZZA_CATEGORIES.includes(item?.pizza?.category ?? '');
  const unitBase = isPizza
    ? getPizzaSizePrice(item?.size?.id, item?.pizza?.category, date)
    : getNonPizzaPrice(item?.pizza, item?.size);
  const supplementsTotal = supplementsOf(item);
  const unitPrice = unitBase + supplementsTotal;
  return { unitBase, supplementsTotal, unitPrice, lineTotal: unitPrice * qty };
}

export function computeLinePricesLocally(items: any[], date: Date = new Date()): OrderLinePrice[] {
  return (items ?? []).map((item) => computeLinePriceLocally(item, date));
}

/** Récupère les prix unitaires calculés par le backend pour une commande. */
export async function fetchOrderLinePrices(
  items: any[],
  at: Date = new Date(),
): Promise<OrderLinePrice[]> {
  const fallback = computeLinePricesLocally(items, at);
  if (!Array.isArray(items) || items.length === 0) return [];
  try {
    const { data, error } = await supabase.rpc('compute_order_line_prices' as any, {
      _items: items as any,
      _now: at.toISOString(),
    });
    if (error || !Array.isArray(data) || data.length !== items.length) return fallback;
    return (data as any[]).map((row, idx) => {
      const qty = items[idx]?.quantity ?? 1;
      const unitBase = Number(row?.unit_price ?? 0);
      const supplementsTotal = Number(row?.supplements_total ?? 0);
      const unitPrice = unitBase + supplementsTotal;
      return { unitBase, supplementsTotal, unitPrice, lineTotal: unitPrice * qty };
    });
  } catch {
    return fallback;
  }
}

/**
 * Prix unitaires (backend) pour une seule commande, avec repli local immédiat
 * le temps de la réponse serveur.
 */
export function useOrderLinePrices(items: any[] | undefined, at?: string | Date): OrderLinePrice[] {
  const date = at ? new Date(at) : new Date();
  const signature = JSON.stringify(items ?? []) + '|' + (at ? new Date(at).toISOString() : '');
  const [prices, setPrices] = useState<OrderLinePrice[]>(() =>
    computeLinePricesLocally(items ?? [], date),
  );

  useEffect(() => {
    let cancelled = false;
    setPrices(computeLinePricesLocally(items ?? [], date));
    fetchOrderLinePrices(items ?? [], date).then((res) => {
      if (!cancelled && res.length) setPrices(res);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return prices;
}

export interface PricedOrderLike {
  id: string;
  items: any[] | null;
  created_at: string;
}

/**
 * Prix unitaires (backend) pour une liste de commandes.
 * Retourne une map `orderId -> OrderLinePrice[]`.
 */
export function useOrdersLinePrices(orders: PricedOrderLike[]): Record<string, OrderLinePrice[]> {
  const signature = orders
    .map((o) => `${o.id}:${o.created_at}:${(o.items ?? []).length}`)
    .join('|');

  const [map, setMap] = useState<Record<string, OrderLinePrice[]>>({});

  useEffect(() => {
    let cancelled = false;

    // Repli immédiat pour éviter tout écran vide.
    const local: Record<string, OrderLinePrice[]> = {};
    orders.forEach((o) => {
      local[o.id] = computeLinePricesLocally(o.items ?? [], new Date(o.created_at));
    });
    setMap(local);

    Promise.all(
      orders.map(async (o) => ({
        id: o.id,
        prices: await fetchOrderLinePrices(o.items ?? [], new Date(o.created_at)),
      })),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, OrderLinePrice[]> = {};
      results.forEach((r) => {
        next[r.id] = r.prices;
      });
      setMap(next);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return map;
}

/** Accès sûr à une ligne, avec repli local si le backend n'a pas encore répondu. */
export function linePriceAt(
  prices: OrderLinePrice[] | undefined,
  index: number,
  item: any,
  date: Date,
): OrderLinePrice {
  return prices?.[index] ?? computeLinePriceLocally(item, date);
}
