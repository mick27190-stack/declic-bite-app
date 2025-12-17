import { MapPin, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Restaurant } from '@/types/pizza';
import { restaurants } from '@/data/pizzas';
import { useCart } from '@/contexts/CartContext';

interface RestaurantSelectorProps {
  onSelect: (restaurant: Restaurant) => void;
}

export function RestaurantSelector({ onSelect }: RestaurantSelectorProps) {
  const { selectedRestaurant } = useCart();

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-display font-bold text-center text-foreground mb-6">
        Choisissez votre restaurant
      </h2>
      
      {restaurants.map((restaurant, index) => (
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
      ))}
    </div>
  );
}
