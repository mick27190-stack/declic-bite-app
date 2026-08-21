/**
 * Promotion: Mardi, toutes les pizzas Senior à 10€
 * Exception : la promo est désactivée si le mardi tombe un jour férié français
 * fixe (1er mai, 8 mai, 14 juillet, 15 août, 1er novembre, 11 novembre).
 */

const PROMO_PRICE = 10;
const PROMO_DAYS = [2]; // Mardi = 2

// Jours fériés fixes (mois 1-12, jour) où la promo est suspendue.
const PROMO_BLOCKED_HOLIDAYS: Array<[number, number]> = [
  [5, 1],   // Fête du Travail
  [5, 8],   // Victoire 1945
  [7, 14],  // Fête nationale
  [8, 15],  // Assomption
  [11, 1],  // Toussaint
  [11, 11], // Armistice
];

export function isBlockedHoliday(date: Date = new Date()): boolean {
  const paris = parisCivilDate(date);
  const m = paris.getMonth() + 1;
  const d = paris.getDate();
  return PROMO_BLOCKED_HOLIDAYS.some(([hm, hd]) => hm === m && hd === d);
}

export function isPromoDay(date: Date = new Date()): boolean {
  return PROMO_DAYS.includes(parisCivilDate(date).getDay()) && !isBlockedHoliday(date);
}


/**
 * Returns the effective base price for a pizza given its size.
 * Senior pizzas are 10€ on Tuesdays instead of 13€.
 */
export const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

export function getEffectiveBasePrice(
  basePrice: number,
  sizeId: string,
  date: Date = new Date(),
  category?: string
): number {
  if (sizeId === 'senior' && isPromoDay(date) && (!category || PIZZA_CATEGORIES.includes(category))) {
    return PROMO_PRICE;
  }
  return basePrice;
}

export const PROMO_LABEL = 'Mardi : Senior à 10€ !';
