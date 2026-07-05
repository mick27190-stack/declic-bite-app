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

export interface DayPromo {
  id: string;
  day_of_week: number; // 0 = dimanche ... 6 = samedi
  size_id: string;
  price: number;
  label: string | null;
  is_active: boolean;
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

function findDayPromo(sizeId: string, date: Date): DayPromo | undefined {
  return _dayPromos.find(
    (p) => p.is_active && p.day_of_week === date.getDay() && p.size_id === sizeId,
  );
}

/**
 * Prix effectif (absolu) d'une pizza pour une taille donnée, en tenant compte
 * des promotions par jour (admin) et de la promo historique Mardi/Mercredi.
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

  // Promo historique : Mardi & Mercredi, Senior à 10€.
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
      ? 'Mardi & Mercredi : Senior à 10€ !'
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
