import { Pizza } from '@/types/pizza';
import { getSizePriceInfo, getNonPizzaPrice } from '@/lib/pricing';
import { usePricing } from '@/contexts/PricingContext';

interface PizzaCardProps {
  pizza: Pizza;
  onClick: () => void;
  unavailable?: boolean;
}

const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

export function PizzaCard({ pizza, onClick, unavailable = false }: PizzaCardProps) {
  usePricing();
  const isPizza = PIZZA_CATEGORIES.includes(pizza.category);
  const info = getSizePriceInfo('senior', pizza.category);
  const showPromo = isPizza && info.isPromo;

  return (
    <button
      onClick={unavailable ? undefined : onClick}
      disabled={unavailable}
      aria-disabled={unavailable}
      className={`pizza-card w-full text-left group relative ${
        unavailable ? 'cursor-not-allowed' : ''
      }`}
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage
          src={pizza.image}
          alt={pizza.name}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            unavailable ? 'grayscale opacity-60' : 'group-hover:scale-110'
          }`}
          iconClassName="h-12 w-12"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {!unavailable && (
          <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-display font-bold text-sm shadow-glow">
            {showPromo ? (
              <span className="flex items-center gap-1">
                <span className="line-through opacity-70 text-xs">{info.base}€</span>
                <span>{info.effective}€</span>
              </span>
            ) : (
              <>{isPizza ? info.effective : getNonPizzaPrice(pizza)}€</>
            )}
          </div>
        )}

        {unavailable && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-wide shadow-lg">
              Indisponible
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3
          className={`text-lg font-display font-bold transition-colors ${
            unavailable
              ? 'text-muted-foreground'
              : 'text-foreground group-hover:text-primary'
          }`}
        >
          {pizza.name}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {pizza.ingredients.join(', ')}
        </p>
      </div>
    </button>
  );
}
