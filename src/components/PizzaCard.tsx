import { Pizza } from '@/types/pizza';
import { isPromoDay } from '@/lib/promo';

interface PizzaCardProps {
  pizza: Pizza;
  onClick: () => void;
}

export function PizzaCard({ pizza, onClick }: PizzaCardProps) {
  return (
    <button
      onClick={onClick}
      className="pizza-card w-full text-left group"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={pizza.image}
          alt={pizza.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        
        {/* Price Badge */}
        <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-display font-bold text-sm shadow-glow">
          {isPromoDay() ? (
            <span className="flex items-center gap-1">
              <span className="line-through opacity-70 text-xs">{pizza.basePrice}€</span>
              <span>10€</span>
            </span>
          ) : (
            <>{pizza.basePrice}€</>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-display font-bold text-foreground group-hover:text-primary transition-colors">
          {pizza.name}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {pizza.ingredients.join(', ')}
        </p>
      </div>
    </button>
  );
}
