/**
 * Tarification dynamique des pizzas (par taille) et promotions par jour.
 * Les prix sont chargés depuis la base de données et mis à jour en temps réel
 * via le PricingProvider. Ce module conserve un état mutable pour permettre
 * aux calculs synchrones (panier) de lire les prix les plus récents.
 */
import { isPromoDay, PIZZA_CATEGORIES } from './promo';
import { parisCivilDate } from './parisTime';


export type SizeId = 'senior' | 'mega' | 'super-mega';

export const DEFAULT_SIZE_PRICES: Record<string, number> = {
  senior: 13.5,
  mega: 20,
  'super-mega': 28,
};

export type PromoRecurrence = 'weekly' | 'monthly' | 'once';
export type PromoType = 'fixed' | 'second_half' | 'bogo';

export interface DayPromo {
  id: string;
  day_of_week: number; // 0 = dimanche ... 6 = samedi
  size_id: string;
  price: number | null;
  label: string | null;
  is_active: boolean;
  recurrence: PromoRecurrence;
  /** 1..4 pour la Nᵉ semaine, -1 pour la dernière du mois. null si weekly/once. */
  week_of_month: number | null;
  /** Date précise (YYYY-MM-DD) pour une promo ponctuelle. null sinon. */
  specific_date: string | null;
  promo_type: PromoType;
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

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function promoMatchesDate(promo: DayPromo, date: Date): boolean {
  if (!promo.is_active) return false;
  // Toutes les comparaisons calendaires se font en heure de Paris.
  const paris = parisCivilDate(date);
  if (promo.recurrence === 'once') {
    return !!promo.specific_date && promo.specific_date === toLocalIsoDate(paris);
  }
  if (promo.day_of_week !== paris.getDay()) return false;
  if (promo.recurrence === 'weekly') return true;
  if (promo.recurrence === 'monthly') {
    if (promo.week_of_month === -1) return isLastWeekdayOfMonth(paris);
    return promo.week_of_month === nthWeekdayOfMonth(paris);
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
  { key: 'coca-cola-1-5l', name: 'Coca-Cola' },
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
  if (promo) {
    // Pour les promos à paire (2ᵉ demi, 1 achetée = 1 offerte), le prix unitaire
    // reste le prix de référence ; la remise est appliquée au niveau du panier.
    if (promo.promo_type === 'fixed' && promo.price != null) return promo.price;
    return base;
  }

  // Promo historique : Mardi, Senior à 10€.
  if (sizeId === 'senior' && isPromoDay(date)) return 10;

  return base;
}

/**
 * Prix "de paire" pour les promos second_half / bogo appliquées au panier.
 * Retourne null si aucune promo à paire n'est active pour cette taille/date.
 */
export function getPairPromoForSize(
  sizeId: string,
  category?: string,
  date: Date = new Date(),
): DayPromo | null {
  const isPizzaCategory = !category || PIZZA_CATEGORIES.includes(category);
  if (!isPizzaCategory) return null;
  const promo = findDayPromo(sizeId, date);
  if (!promo) return null;
  if (promo.promo_type === 'second_half' || promo.promo_type === 'bogo') return promo;
  return null;
}

/**
 * Applique une remise "2ᵉ à moitié prix" ou "1 achetée = 1 offerte" sur
 * `quantity` unités au prix de référence `refPrice`. Retourne le total base
 * (hors suppléments) pour la ligne.
 */
export function computePairPromoLineTotal(
  promoType: PromoType,
  refPrice: number,
  quantity: number,
): number {
  const pairs = Math.floor(quantity / 2);
  const singles = quantity % 2;
  if (promoType === 'second_half') {
    return pairs * (refPrice + refPrice / 2) + singles * refPrice;
  }
  if (promoType === 'bogo') {
    return (pairs + singles) * refPrice;
  }
  return refPrice * quantity;
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
  let promoLabel: string | null = null;
  if (promo) {
    if (promo.label) promoLabel = promo.label;
    else if (promo.promo_type === 'second_half') promoLabel = '2ᵉ à -50%';
    else if (promo.promo_type === 'bogo') promoLabel = '1 achetée = 1 offerte';
  } else if (sizeId === 'senior' && isPromoDay(date)) {
    promoLabel = 'Mardi : Senior à 10€ !';
  }
  const isPairPromo = !!promo && (promo.promo_type === 'second_half' || promo.promo_type === 'bogo');
  return { base, effective, isPromo: isPairPromo || effective < base, promoLabel };
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
