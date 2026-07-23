/**
 * Tarification dynamique des pizzas (par taille) et promotions par jour.
 * Les prix sont chargés depuis la base de données et mis à jour en temps réel
 * via le PricingProvider. Ce module conserve un état mutable pour permettre
 * aux calculs synchrones (panier) de lire les prix les plus récents.
 */
import { isPromoDay, PIZZA_CATEGORIES } from './promo';

export type SizeId = 'senior' | 'mega' | 'super-mega';

export const DEFAULT_SIZE_PRICES: Record<string, number> = {
  senior: 13.5,
  mega: 20,
  'super-mega': 28,
};

export type PromoRecurrence = 'weekly' | 'monthly';

export interface DayPromo {
  id: string;
  day_of_week: number; // 0 = dimanche ... 6 = samedi
  size_id: string;
  price: number;
  label: string | null;
  is_active: boolean;
  recurrence: PromoRecurrence;
  /** 1..4 pour la Nᵉ semaine, -1 pour la dernière du mois. null si weekly. */
  week_of_month: number | null;
}

/** 1st, 2nd, 3rd, 4th of month, or last (-1). */
function nthWeekdayOfMonth(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function isLastWeekdayOfMonth(date: Date): boolean {
  const d = new Date(date);
  d.setDate(d.getDate() + 7);
  return d.getMonth() !== date.getMonth();
}

export function promoMatchesDate(promo: DayPromo, date: Date): boolean {
  if (!promo.is_active) return false;
  if (promo.day_of_week !== date.getDay()) return false;
  if (promo.recurrence === 'weekly') return true;
  if (promo.recurrence === 'monthly') {
    if (promo.week_of_month === -1) return isLastWeekdayOfMonth(date);
    return promo.week_of_month === nthWeekdayOfMonth(date);
  }
  return false;
}

let _sizePrices: Record<string, number> = { ...DEFAULT_SIZE_PRICES };
let _dayPromos: DayPromo[] = [];

export function setPricingData(sizePrices: Record<string, number>, dayPromos: DayPromo[]) {
  _sizePrices = { ...DEFAULT_SIZE_PRICES, ...sizePrices };
  _dayPromos = dayPromos;
}

export function getRawSizePrice(sizeId: string): number {
  return _sizePrices[sizeId] ?? DEFAULT_SIZE_PRICES[sizeId] ?? 0;
}

export function getAllSizePrices(): Record<string, number> {
  return { ..._sizePrices };
}

export function getDayPromos(): DayPromo[] {
  return _dayPromos;
}

// ============= Autres éléments du menu (boissons, paninis, bambino) =============

export const DEFAULT_ITEM_PRICES: Record<string, number> = {
  'coca-cola-1-5l': 3,
  'rose-bouteille': 7,
  bambino: 7,
  'bambino-pizza-seule': 6,
  'panini-simple': 6,
  'panini-double': 9,
};

export const MANAGED_ITEMS: { key: string; name: string }[] = [
  { key: 'coca-cola-1-5l', name: 'Coca-Cola 1,5L' },
  { key: 'rose-bouteille', name: 'Bouteille de Rosé' },
  { key: 'panini-simple', name: 'Panini simple' },
  { key: 'panini-double', name: 'Panini double' },
  { key: 'bambino', name: 'Menu Bambino' },
  { key: 'bambino-pizza-seule', name: 'Pizza Seule Bambino' },
];

let _itemPrices: Record<string, number> = { ...DEFAULT_ITEM_PRICES };

export function setItemPrices(itemPrices: Record<string, number>) {
  _itemPrices = { ...DEFAULT_ITEM_PRICES, ...itemPrices };
}

export function getItemPrice(key: string): number {
  return _itemPrices[key] ?? DEFAULT_ITEM_PRICES[key] ?? 0;
}

export function getAllItemPrices(): Record<string, number> {
  return { ..._itemPrices };
}

/**
 * Prix des éléments non-pizza (boissons, paninis, bambino) en tenant compte
 * des tarifs configurés par l'admin. `size` s'applique aux paninis
 * (Simple / Double).
 */
export function getNonPizzaPrice(
  pizza: { id: string; category: string; basePrice: number },
  size?: { id: string; price: number },
): number {
  if (pizza.category === 'paninis') {
    return size?.id === 'mega'
      ? getItemPrice('panini-double')
      : getItemPrice('panini-simple');
  }
  if (pizza.id === 'bambino') return getItemPrice('bambino');
  if (pizza.id in DEFAULT_ITEM_PRICES) return getItemPrice(pizza.id);
  return pizza.basePrice + (size?.price ?? 0);
}

function findDayPromo(sizeId: string, date: Date): DayPromo | undefined {
  const matches = _dayPromos.filter(
    (p) => p.size_id === sizeId && promoMatchesDate(p, date),
  );
  // Une règle mensuelle (plus spécifique) prime sur une règle hebdomadaire.
  return (
    matches.find((p) => p.recurrence === 'monthly') ?? matches[0]
  );
}

/**
 * Prix effectif (absolu) d'une pizza pour une taille donnée, en tenant compte
 * des promotions par jour (admin) et de la promo historique Mardi.
 */
export function getPizzaSizePrice(
  sizeId: string,
  category?: string,
  date: Date = new Date(),
): number {
  const base = getRawSizePrice(sizeId);
  const isPizzaCategory = !category || PIZZA_CATEGORIES.includes(category);
  if (!isPizzaCategory) return base;

  // Une promo configurée par l'admin est prioritaire.
  const promo = findDayPromo(sizeId, date);
  if (promo) return promo.price;

  // Promo historique : Mardi, Senior à 10€.
  if (sizeId === 'senior' && isPromoDay(date)) return 10;

  return base;
}

export interface SizePriceInfo {
  base: number;
  effective: number;
  isPromo: boolean;
  promoLabel: string | null;
}

export function getSizePriceInfo(
  sizeId: string,
  category?: string,
  date: Date = new Date(),
): SizePriceInfo {
  const base = getRawSizePrice(sizeId);
  const effective = getPizzaSizePrice(sizeId, category, date);
  const promo = findDayPromo(sizeId, date);
  const promoLabel = promo
    ? promo.label
    : sizeId === 'senior' && isPromoDay(date)
      ? 'Mardi : Senior à 10€ !'
      : null;
  return { base, effective, isPromo: effective < base, promoLabel };
}

export const DAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];
