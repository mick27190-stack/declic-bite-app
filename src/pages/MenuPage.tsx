import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, AlertTriangle } from 'lucide-react';
import { PizzaCard } from '@/components/PizzaCard';
import { PizzaDetailModal } from '@/components/PizzaDetailModal';
import { BottomNavigation } from '@/components/BottomNavigation';
import CustomerNotificationBell from '@/components/CustomerNotificationBell';
import { pizzas, categories } from '@/data/pizzas';
import { Pizza } from '@/types/pizza';
import { useCart } from '@/contexts/CartContext';

import { ActivePromoBanner } from '@/components/ActivePromoBanner';
import { useMenuAvailability } from '@/hooks/useMenuAvailability';
import { useMenuOverrides } from '@/hooks/useMenuOverrides';
import { OrdersClosedBanner } from '@/components/OrdersClosedBanner';


export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const { selectedRestaurant } = useCart();


  const navigate = useNavigate();
  const { isAvailable } = useMenuAvailability();
  const { applyToList } = useMenuOverrides();

  const filteredPizzas = applyToList(pizzas).filter((pizza) => {
    const matchesCategory = selectedCategory === 'all' || pizza.category === selectedCategory;
    const matchesSearch = pizza.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pizza.ingredients.some((i) => i.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch && pizza.isAvailable;
  });

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-4">
          {/* Restaurant & Back */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Retour</span>
            </button>
            <div className="flex items-center gap-1">
              {selectedRestaurant && (
                <span className="text-sm font-medium text-primary">
                  {selectedRestaurant.name.replace('Déclic Pizza ', '')}
                </span>
              )}
              <CustomerNotificationBell />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">
            Nos Pizzas 🍕
          </h1>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une pizza..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-muted rounded-xl border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              Toutes
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {category.emoji} {category.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Pizza Grid */}
      <main className="max-w-md mx-auto px-4 py-6">
        <OrdersClosedBanner className="mb-4" />

        <ActivePromoBanner className="mb-4" />

        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Livraison hors Conches &amp; Beaumont</p>
            <p className="text-sm text-foreground mt-1">
              Minimum de commande de <strong className="text-primary">20€</strong> (2 pizzas Senior ou 1 pizza Méga).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {filteredPizzas.map((pizza, index) => {
            const unavailable = !isAvailable(pizza.id, selectedRestaurant?.id);
            return (
              <div
                key={pizza.id}
                className="fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PizzaCard
                  pizza={pizza}
                  unavailable={unavailable}
                  onClick={() => setSelectedPizza(pizza)}
                />
              </div>
            );
          })}
        </div>

        {filteredPizzas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune pizza trouvée</p>
          </div>
        )}
      </main>

      {/* Pizza Detail Modal */}
      {selectedPizza && (
        <PizzaDetailModal
          pizza={selectedPizza}
          onClose={() => setSelectedPizza(null)}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
