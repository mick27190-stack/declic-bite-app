import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { DeliveryZoneChecker } from '@/components/DeliveryZoneChecker';

export function CartView() {
  const { items, removeItem, updateQuantity, totalPrice, selectedRestaurant } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Votre panier est vide
        </h2>
        <p className="text-muted-foreground mb-6">
          Découvrez nos délicieuses pizzas et ajoutez-les à votre panier !
        </p>
        <Button asChild variant="hero">
          <Link to="/menu">Voir le menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {/* Restaurant info */}
      {selectedRestaurant && (
        <div className="glass-card p-4 mb-6">
          <p className="text-sm text-muted-foreground">Commande pour</p>
          <p className="font-display font-bold text-primary">{selectedRestaurant.name}</p>
        </div>
      )}

      {/* Delivery Zone Checker */}
      <DeliveryZoneChecker />

      {/* Cart Items */}
      {items.map((item, index) => {
        const itemTotal =
          (item.pizza.basePrice +
            item.size.price +
            item.supplements.reduce((sum, s) => sum + s.price, 0)) *
          item.quantity;

        return (
          <div key={index} className="glass-card p-4 flex gap-4">
            <img
              src={item.pizza.image}
              alt={item.pizza.name}
              className="w-20 h-20 object-cover rounded-xl"
            />
            
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-foreground truncate">
                {item.pizza.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.size.name} • Base {item.base}
              </p>
              {item.supplements.length > 0 && (
                <p className="text-xs text-primary">
                  + {item.supplements.map((s) => s.name).join(', ')}
                </p>
              )}
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(index, item.quantity - 1)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-foreground w-6 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(index, item.quantity + 1)}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-primary">
                    {itemTotal.toFixed(2)}€
                  </span>
                  <button
                    onClick={() => removeItem(index)}
                    className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Fixed bottom checkout */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-foreground">Total</span>
            <span className="text-2xl font-display font-bold text-primary">
              {totalPrice.toFixed(2)}€
            </span>
          </div>
          <Button variant="hero" size="lg" className="w-full">
            Commander maintenant
          </Button>
        </div>
      </div>
    </div>
  );
}
