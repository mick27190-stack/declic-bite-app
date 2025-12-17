export interface Pizza {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  image: string;
  basePrice: number;
  category: 'classiques' | 'speciales' | 'vegetariennes' | 'gourmandes';
  isAvailable: boolean;
}

export interface PizzaSize {
  id: 'senior' | 'mega' | 'super-mega';
  name: string;
  price: number;
  description: string;
}

export interface Supplement {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  pizza: Pizza;
  size: PizzaSize;
  base: 'tomate' | 'creme';
  supplements: Supplement[];
  quantity: number;
}

export interface Restaurant {
  id: 'conches' | 'beaumont';
  name: string;
  address: string;
  phone: string;
  hours: string;
}

export type OrderType = 'emporter' | 'livraison';
