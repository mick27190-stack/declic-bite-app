import { MapPin, Phone, Clock, AlertTriangle, BookOpen } from 'lucide-react';
import { closureMessage, closureTitle } from '@/lib/closureMessages';
import { Restaurant } from '@/types/pizza';
import { restaurants } from '@/data/pizzas';
import { useCart } from '@/contexts/CartContext';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { useLiveParisTime } from '@/hooks/useLiveParisTime';

interface RestaurantSelectorProps {
  onSelect: (restaurant: Restaurant) => void;
  /** Consultation du menu autorisée même quand le site est bloqué/fermé. */
  onViewMenu?: (restaurant: Restaurant) => void;
}

export function RestaurantSelector({ onSelect, onViewMenu }: RestaurantSelectorProps) {
  const { selectedRestaurant } = useCart();
  const { getClosureForSite } = useActiveClosures();
  const now = useLiveParisTime();

  // Les sites sont fermés tous les lundis : aucun appel possible ce jour-là.
  const isMonday =
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).format(now) ===
    'Mon';

  // À partir de 22h (heure de Paris), les restaurants ont fermé : on bloque
  // aussi les boutons d'appel affichés pendant un blocage admin.
  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const isAfterClosing = parisHour >= 22;

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
                    {closureTitle(isSiteClosed ? 'site' : 'orders')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {closureMessage(isSiteClosed ? 'site' : 'orders', closure.reason)}
                  </p>
                </div>
              </div>

              {isSiteClosed || isMonday ? (
                <div className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground font-semibold py-3 px-4 cursor-not-allowed">
                  <Phone className="w-4 h-4" />
                  {isSiteClosed ? 'Site injoignable' : 'Fermé le lundi'}
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

              {onViewMenu && (
                <button
                  type="button"
                  onClick={() => onViewMenu(restaurant)}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/80 text-foreground font-semibold py-3 px-4 transition-colors hover:text-primary hover:border-primary/50"
                >
                  <BookOpen className="w-4 h-4" />
                  Consulter le menu
                </button>
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
