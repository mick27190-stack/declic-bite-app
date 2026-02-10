/**
 * Promotion: Mardi et Mercredi, toutes les pizzas Senior à 10€
 */

const PROMO_PRICE = 10;
const PROMO_DAYS = [2, 3]; // Mardi = 2, Mercredi = 3

export function isPromoDay(date: Date = new Date()): boolean {
  return PROMO_DAYS.includes(date.getDay());
}

/**
 * Returns the effective base price for a pizza given its size.
 * Senior pizzas are 10€ on Tuesdays and Wednesdays instead of 13€.
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

export const PROMO_LABEL = 'Mardi & Mercredi : Senior à 10€ !';
