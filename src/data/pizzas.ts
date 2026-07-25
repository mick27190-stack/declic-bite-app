import { Pizza, PizzaSize, Supplement, Restaurant } from '@/types/pizza';

import pizzaMargherita from '@/assets/pizza-margherita.jpg';
import pizzaChevreMiel from '@/assets/pizza-chevre-miel.jpg';
import pizzaVegetarienne from '@/assets/pizza-vegetarienne.jpg';
import pizzaCarnivore from '@/assets/pizza-carnivore.jpg';
import pizzaSaumon from '@/assets/pizza-saumon.jpg';
import pizzaPoulet from '@/assets/pizza-poulet.jpg';
import pizzaChampignons from '@/assets/pizza-champignons.jpg';
import pizzaCalzone from '@/assets/pizza-calzone.jpg';
import pizzaFruitsDeMer from '@/assets/pizza-fruits-de-mer.jpg';
import pizzaKebab from '@/assets/pizza-kebab.jpg';
import pizzaQuatreFromages from '@/assets/pizza-quatre-fromages.jpg';
import pizzaFondante from '@/assets/pizza-fondante.jpg';
import pizzaOrientale from '@/assets/pizza-orientale.jpg';
import pizzaChef from '@/assets/pizza-chef.jpg';
import pizzaAuvergnate from '@/assets/pizza-auvergnate.jpg';
import pizzaSavoyarde from '@/assets/pizza-savoyarde.jpg';
import pizzaRaclette from '@/assets/pizza-raclette.jpg';
import pizzaBurger from '@/assets/pizza-burger.jpg';
import pizzaMalyson from '@/assets/pizza-malyson.jpg';
import pizzaJuju from '@/assets/pizza-juju.jpg';
import pizzaBolognaise from '@/assets/pizza-bolognaise.jpg';
import pizzaDelice from '@/assets/pizza-delice.jpg';
import pizzaExtravagante from '@/assets/pizza-extravagante.jpg';
import pizzaPaysanne from '@/assets/pizza-paysanne.jpg';
import pizzaThonata from '@/assets/pizza-thonata.jpg';
import pizzaAntillaise from '@/assets/pizza-antillaise.jpg';
import pizzaForestiere from '@/assets/pizza-forestiere.jpg';
import pizzaNapolitaine from '@/assets/pizza-napolitaine.jpg';
import menuBambino from '@/assets/menu-bambino.jpg';
import paniniQuatreFromages from '@/assets/panini-quatre-fromages.jpg';
import paniniJambon from '@/assets/panini-jambon.jpg';
import paniniSavoyard from '@/assets/panini-savoyard.jpg';
import paniniRaclette from '@/assets/panini-raclette.jpg';
import boissonCoca from '@/assets/boisson-coca.jpg';
import boissonRose from '@/assets/boisson-rose.jpg';

export const pizzas: Pizza[] = [
  // Classiques
  {
    id: 'margarita',
    name: 'Margarita',
    description: 'La classique italienne',
    ingredients: ['Tomate', 'Mozzarella', 'Jambon'],
    image: pizzaMargherita,
    basePrice: 13.5,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'reine',
    name: 'Reine',
    description: 'Un grand classique avec jambon et champignons',
    ingredients: ['Tomate', 'Mozzarella', 'Jambon', 'Champignons'],
    image: pizzaChampignons,
    basePrice: 13.5,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'quatre-fromages',
    name: 'Quatre Fromages',
    description: 'Pour les amateurs de fromage',
    ingredients: ['Tomate', 'Mozzarella', 'Chèvre', 'Camembert', 'Bleu', 'Crème fraîche'],
    image: pizzaQuatreFromages,
    basePrice: 13.5,
    category: 'classiques',
    isAvailable: true,
  },
  {
    id: 'napolitaine',
    name: 'Napolitaine',
    description: 'Saveurs méditerranéennes authentiques',
    ingredients: ['Tomate', 'Mozzarella', 'Anchois', 'Câpres', 'Olives noires'],
    image: pizzaNapolitaine,
    basePrice: 13.5,
    category: 'classiques',
    isAvailable: true,
  },

  // Végétariennes
  {
    id: 'vegetarienne',
    name: 'Végétarienne',
    description: 'Un festival de légumes frais',
    ingredients: ['Tomate', 'Mozzarella', 'Poivrons', 'Oignons', 'Champignons'],
    image: pizzaVegetarienne,
    basePrice: 13.5,
    category: 'vegetariennes',
    isAvailable: true,
  },

  // Spéciales
  {
    id: 'paysanne',
    name: 'Paysanne',
    description: 'Généreuse et rustique',
    ingredients: ['Tomate', 'Mozzarella', 'Pommes de terre', 'Jambon', 'Crème fraîche', 'Œuf'],
    image: pizzaPaysanne,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'nordique',
    name: 'Nordique',
    description: 'Saveurs de la mer avec saumon fumé',
    ingredients: ['Tomate', 'Mozzarella', 'Saumon fumé', 'Crème fraîche'],
    image: pizzaSaumon,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'orientale',
    name: 'Orientale',
    description: 'Épices et saveurs du Maghreb',
    ingredients: ['Tomate', 'Mozzarella', 'Merguez', 'Chorizo', 'Poivrons', 'Œuf', 'Crème fraîche'],
    image: pizzaOrientale,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'chef',
    name: 'Chef',
    description: 'La préférée du chef',
    ingredients: ['Tomate', 'Mozzarella', 'Jambon', 'Lardons', 'Œuf', 'Champignons'],
    image: pizzaChef,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'auvergnate',
    name: "L'Auvergnate",
    description: 'Spécialité montagnarde',
    ingredients: ['Tomate', 'Mozzarella', 'Bacon', 'Pommes de terre', 'Bleu', 'Œuf', 'Crème fraîche'],
    image: pizzaAuvergnate,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'savoyarde',
    name: 'Savoyarde',
    description: 'Inspirée de la tartiflette',
    ingredients: ['Tomate', 'Mozzarella', 'Tartiflette', 'Pommes de terre', 'Lardons', 'Oignons', 'Crème fraîche'],
    image: pizzaSavoyarde,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'speciale',
    name: 'La Spéciale',
    description: 'Une création originale au curry',
    ingredients: ['Tomate', 'Mozzarella', 'Poulet', 'Pommes de terre', 'Curry', 'Crème fraîche'],
    image: pizzaPoulet,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'raclette',
    name: 'La Raclette',
    description: 'Gourmandise savoyarde',
    ingredients: ['Tomate', 'Mozzarella', 'Bacon', 'Fromage à raclette', 'Oignons', 'Lardons', 'Pommes de terre'],
    image: pizzaRaclette,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'mediterraneenne',
    name: 'La Méditerranéenne',
    description: 'Fruits de mer et saveurs du sud',
    ingredients: ['Tomate', 'Mozzarella', 'Cocktail de fruits de mer', 'Beurre d\'escargots', 'Crème fraîche'],
    image: pizzaFruitsDeMer,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'fondante',
    name: 'La Fondante',
    description: 'Fondante et savoureuse',
    ingredients: ['Tomate', 'Mozzarella', 'Boursin', 'Jambon', 'Crème fraîche', 'Olives'],
    image: pizzaFondante,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'thonata',
    name: 'La Thonata',
    description: 'Pour les amateurs de thon',
    ingredients: ['Tomate', 'Mozzarella', 'Thon', 'Anchois', 'Olives', 'Crème fraîche'],
    image: pizzaThonata,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'forestiere',
    name: 'La Forestière',
    description: 'Saveurs de la forêt',
    ingredients: ['Tomate', 'Mozzarella', 'Champignons', 'Jambon', 'Œuf', 'Crème'],
    image: pizzaForestiere,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },
  {
    id: 'antillaise',
    name: "L'Antillaise",
    description: 'Exotique et sucrée-salée',
    ingredients: ['Tomate', 'Mozzarella', 'Poulet', 'Ananas', 'Miel'],
    image: pizzaAntillaise,
    basePrice: 13.5,
    category: 'speciales',
    isAvailable: true,
  },

  // Gourmandes
  {
    id: 'burger',
    name: 'La Burger',
    description: 'Tous les goûts du burger sur une pizza',
    ingredients: ['Tomate', 'Mozzarella', 'Oignons', 'Bacon', 'Cheddar', 'Viande hachée', 'Sauce burger'],
    image: pizzaBurger,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'malyson',
    name: 'La Malyson',
    description: 'Généreuse et gourmande',
    ingredients: ['Tomate', 'Mozzarella', 'Bacon', 'Camembert', 'Tartiflette', 'Lardons', 'Crème fraîche'],
    image: pizzaMalyson,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'juju',
    name: 'La Juju',
    description: 'Poulet barbecue irrésistible',
    ingredients: ['Tomate', 'Mozzarella', 'Poulet', 'Oignons', 'Bacon', 'Crème fraîche', 'Sauce barbecue'],
    image: pizzaJuju,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'mielleuse',
    name: 'La Mielleuse',
    description: 'Douceur du chèvre et miel',
    ingredients: ['Tomate', 'Mozzarella', 'Chèvre', 'Miel'],
    image: pizzaChevreMiel,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'bolognaise',
    name: 'La Bolognaise',
    description: 'Viande hachée à l\'italienne',
    ingredients: ['Tomate', 'Mozzarella', 'Viande hachée', 'Œuf', 'Oignons'],
    image: pizzaBolognaise,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'delice',
    name: 'La Délice',
    description: 'Un délice normand',
    ingredients: ['Tomate', 'Mozzarella', 'Andouille', 'Camembert', 'Crème fraîche'],
    image: pizzaDelice,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'extravagante',
    name: "L'Extravagante",
    description: 'Pour les grandes faims',
    ingredients: ['Tomate', 'Mozzarella', 'Viande hachée', 'Merguez', 'Chèvre', 'Œuf'],
    image: pizzaExtravagante,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'calzone',
    name: 'La Calzone',
    description: 'Pizza pliée et garnie',
    ingredients: ['Tomate', 'Mozzarella', 'Jambon', 'Œuf', 'Crème fraîche', 'Champignons'],
    image: pizzaCalzone,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  {
    id: 'kebab',
    name: 'Kébab',
    description: 'Saveurs orientales',
    ingredients: ['Tomate', 'Mozzarella', 'Viande à kébab', 'Oignons'],
    image: pizzaKebab,
    basePrice: 13.5,
    category: 'gourmandes',
    isAvailable: true,
  },
  // Bambino
  {
    id: 'bambino',
    name: 'Menu Bambino',
    description: 'Pizza au choix + boisson + bonbon',
    ingredients: ['Pizza au choix', 'Boisson', 'Bonbon'],
    image: menuBambino,
    basePrice: 7,
    category: 'bambino',
    isAvailable: true,
    hasSize: false,
    hasBase: true,
    hasSupplements: false,
  },
  {
    id: 'bambino-pizza-seule',
    name: 'Pizza Seule Bambino',
    description: 'Pizza au choix en taille enfant',
    ingredients: ['Pizza au choix'],
    image: menuBambino,
    basePrice: 6,
    category: 'bambino',
    isAvailable: true,
    hasSize: false,
    hasBase: true,
    hasSupplements: false,
  },

  // Paninis
  {
    id: 'panini-4fromages',
    name: 'Panini 4 Fromages',
    description: 'Panini garni de 4 fromages fondants',
    ingredients: ['Mozzarella', 'Chèvre', 'Camembert', 'Bleu'],
    image: paniniQuatreFromages,
    basePrice: 6,
    category: 'paninis',
    isAvailable: true,
    hasSize: true,
    hasBase: true,
    hasSupplements: false,
  },
  {
    id: 'panini-jambon',
    name: 'Panini Jambon',
    description: 'Panini au jambon et fromage',
    ingredients: ['Jambon', 'Mozzarella'],
    image: paniniJambon,
    basePrice: 6,
    category: 'paninis',
    isAvailable: true,
    hasSize: true,
    hasBase: true,
    hasSupplements: false,
  },
  {
    id: 'panini-savoyard',
    name: 'Panini Savoyard',
    description: 'Panini aux saveurs de montagne',
    ingredients: ['Fromage à raclette', 'Pommes de terre', 'Lardons'],
    image: paniniSavoyard,
    basePrice: 6,
    category: 'paninis',
    isAvailable: true,
    hasSize: true,
    hasBase: true,
    hasSupplements: false,
  },
  {
    id: 'panini-raclette',
    name: 'Panini Raclette',
    description: 'Panini au fromage à raclette fondant',
    ingredients: ['Fromage à raclette', 'Pommes de terre', 'Oignons'],
    image: paniniRaclette,
    basePrice: 6,
    category: 'paninis',
    isAvailable: true,
    hasSize: true,
    hasBase: true,
    hasSupplements: false,
  },

  // Boissons
  {
    id: 'coca-cola-1-5l',
    name: 'Coca-Cola',
    description: 'Bouteille de Coca-Cola',
    ingredients: [],
    image: boissonCoca,
    basePrice: 3,
    category: 'boissons',
    isAvailable: true,
    hasSize: false,
    hasBase: false,
    hasSupplements: false,
  },
  {
    id: 'rose-bouteille',
    name: 'Bouteille de Rosé',
    description: 'Bouteille de vin rosé',
    ingredients: [],
    image: boissonRose,
    basePrice: 7,
    category: 'boissons',
    isAvailable: true,
    hasSize: false,
    hasBase: false,
    hasSupplements: false,
  },
];

export const pizzaSizes: PizzaSize[] = [
  {
    id: 'senior',
    name: 'Senior',
    price: 0,
    description: 'Idéale\npour 1 personne',
  },
  {
    id: 'mega',
    name: 'Méga',
    price: 6.5,
    description: 'Parfaite\nà partager',
  },
  {
    id: 'super-mega',
    name: 'Super Méga',
    price: 14.5,
    description: 'Pour les\ngrandes faims',
  },
];

export const paniniSizes: PizzaSize[] = [
  {
    id: 'senior',
    name: 'Simple',
    price: 0,
    description: 'Panini simple (6€)',
  },
  {
    id: 'mega',
    name: 'Double',
    price: 3,
    description: 'Panini double (9€)',
  },
];

export const supplements: Supplement[] = [
  { id: 'jambon', name: 'Jambon', price: 1 },
  { id: 'champignons', name: 'Champignons', price: 1 },
  { id: 'oeuf', name: 'Œuf', price: 1 },
  { id: 'merguez', name: 'Merguez', price: 1 },
  { id: 'chevre', name: 'Chèvre', price: 1 },
  { id: 'lardons', name: 'Lardons', price: 1 },
  { id: 'oignons', name: 'Oignons', price: 1 },
  { id: 'poivrons', name: 'Poivrons', price: 1 },
  { id: 'olives', name: 'Olives', price: 1 },
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
  { id: 'bambino', name: 'Bambino', emoji: '👶' },
  { id: 'paninis', name: 'Paninis', emoji: '🥖' },
  { id: 'boissons', name: 'Boissons', emoji: '🥤' },
];
