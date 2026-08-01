import { MapPin, Phone, Clock, AlertTriangle } from 'lucide-react';
import { Restaurant } from '@/types/pizza';
import { restaurants } from '@/data/pizzas';
import { useCart } from '@/contexts/CartContext';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';

interface RestaurantSelectorProps {
  onSelect: (restaurant: Restaurant) => void;
}

export function RestaurantSelector({ onSelect }: RestaurantSelectorProps) {
  const { selectedRestaurant } = useCart();
  const { getClosureForSite } = useActiveClosures();

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-display font-bold text-center text-foreground mb-6">
        Choisissez votre restaurant
      </h2>

      {restaurants.map((restaurant, index) => {
        const closure = getClosureForSite(restaurant.id || restaurant.name);
        const telHref = `tel:${restaurant.phone.replace(/[^0-9+]/g, '')}`;

        if (closure) {
          const isSiteClosed = closure.closure_type === 'site';
          return (
            <div
              key={restaurant.id}
              className="w-full glass-card p-5 text-left border-destructive/40 opacity-90"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <h3 className="text-xl font-display font-bold text-primary mb-3">
                {restaurant.name}
              </h3>

              <div className="flex items-start gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {isSiteClosed ? 'Site fermé' : 'Commandes en ligne bloquées'}
                  </p>
                  {closure.reason && (
                    <p className="text-sm text-muted-foreground mt-1">{closure.reason}</p>
                  )}
                </div>
              </div>

              {isSiteClosed ? (
                <div className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground font-semibold py-3 px-4 cursor-not-allowed">
                  <Phone className="w-4 h-4" />
                  Site injoignable
                </div>
              ) : (
                <a
                  href={telHref}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 px-4 transition-transform hover:-translate-y-0.5"
                >
                  <Phone className="w-4 h-4" />
                  Appeler le {restaurant.phone}
                </a>
              )}
            </div>
          );
        }

        return (
          <button
            key={restaurant.id}
            onClick={() => onSelect(restaurant)}
            className={`w-full glass-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 ${
              selectedRestaurant?.id === restaurant.id
                ? 'border-primary shadow-glow'
                : 'border-border/50'
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <h3 className="text-xl font-display font-bold text-primary mb-3">
              {restaurant.name}
            </h3>

            <div className="space-y-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm">{restaurant.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm">{restaurant.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">{restaurant.hours}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
