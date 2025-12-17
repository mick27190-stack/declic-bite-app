import { Pizza, PizzaSize, Supplement, Restaurant } from '@/types/pizza';

import pizzaMargherita from '@/assets/pizza-margherita.jpg';
import pizzaChevreMiel from '@/assets/pizza-chevre-miel.jpg';
import pizzaVegetarienne from '@/assets/pizza-vegetarienne.jpg';
import pizzaCarnivore from '@/assets/pizza-carnivore.jpg';

export const pizzas: Pizza[] = [
  {
    id: 'margarita',
    name: 'Margarita',
    description: 'La classique italienne, simple et délicieuse',
    ingredients: ['Tomate', 'Mozzarella', 'Basilic frais'],
    image: pizzaMargherita,
    basePrice: 13,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'reine',
    name: 'Reine',
    description: 'Un grand classique avec jambon et champignons',
    ingredients: ['Tomate', 'Mozzarella', 'Jambon', 'Champignons'],
    image: pizzaCarnivore,
    basePrice: 13,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'vegetarienne',
    name: 'Végétarienne',
    description: 'Un festival de légumes frais et colorés',
    ingredients: ['Tomate', 'Mozzarella', 'Poivrons', 'Oignons', 'Champignons', 'Olives'],
    image: pizzaVegetarienne,
    basePrice: 13,
    category: 'vegetariennes',
    isAvailable: true,
  },
  {
    id: 'mielleuse',
    name: 'La Mielleuse',
    description: 'Douceur du chèvre et miel sur base crème',
    ingredients: ['Crème', 'Mozzarella', 'Chèvre', 'Miel', 'Noix'],
    image: pizzaChevreMiel,
    basePrice: 14,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'nordique',
    name: 'Nordique',
    description: 'Saveurs de la mer avec saumon fumé',
    ingredients: ['Crème fraîche', 'Mozzarella', 'Saumon fumé', 'Aneth'],
    image: pizzaChevreMiel,
    basePrice: 15,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'burger',
    name: 'La Burger',
    description: 'Tous les goûts du burger sur une pizza',
    ingredients: ['Tomate', 'Mozzarella', 'Viande hachée', 'Oignons', 'Cheddar', 'Sauce burger'],
    image: pizzaCarnivore,
    basePrice: 14,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'quatre-fromages',
    name: 'Quatre Fromages',
    description: 'Pour les amateurs de fromage',
    ingredients: ['Crème', 'Mozzarella', 'Chèvre', 'Camembert', 'Bleu'],
    image: pizzaChevreMiel,
    basePrice: 14,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'orientale',
    name: 'Orientale',
    description: 'Épices et saveurs du Maghreb',
    ingredients: ['Tomate', 'Mozzarella', 'Merguez', 'Chorizo', 'Poivrons', 'Œuf'],
    image: pizzaCarnivore,
    basePrice: 14,
    category: 'speciales',
    isAvailable: true,
  },
];

export const pizzaSizes: PizzaSize[] = [
  {
    id: 'senior',
    name: 'Senior',
    price: 0,
    description: 'Idéale pour 1 personne',
  },
  {
    id: 'mega',
    name: 'Méga',
    price: 7,
    description: 'Parfaite à partager',
  },
  {
    id: 'super-mega',
    name: 'Super Méga',
    price: 15,
    description: 'Pour les grandes faims',
  },
];

export const supplements: Supplement[] = [
  { id: 'extra-fromage', name: 'Extra Fromage', price: 1.5 },
  { id: 'jambon', name: 'Jambon', price: 1 },
  { id: 'champignons', name: 'Champignons', price: 1 },
  { id: 'oeuf', name: 'Œuf', price: 1 },
  { id: 'merguez', name: 'Merguez', price: 1.5 },
  { id: 'chevre', name: 'Chèvre', price: 1.5 },
];

export const restaurants: Restaurant[] = [
  {
    id: 'conches',
    name: 'Déclic Pizza Conches',
    address: '1 Place Carnot, 27190 Conches-en-Ouche',
    phone: '02.32.38.41.77',
    hours: 'Mar-Dim: 18h-22h',
  },
  {
    id: 'beaumont',
    name: 'Déclic Pizza Beaumont',
    address: '66 Rue Saint Nicolas, 27170 Beaumont-le-Roger',
    phone: '02.27.19.74.52',
    hours: 'Mar-Dim: 18h-22h',
  },
];

export const categories = [
  { id: 'classiques', name: 'Classiques', emoji: '🍕' },
  { id: 'speciales', name: 'Spéciales', emoji: '⭐' },
  { id: 'vegetariennes', name: 'Végétariennes', emoji: '🥗' },
  { id: 'gourmandes', name: 'Gourmandes', emoji: '🔥' },
];
