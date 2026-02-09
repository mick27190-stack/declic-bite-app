import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { DeliveryZoneChecker } from '@/components/DeliveryZoneChecker';
import { OrderTypeSelector } from '@/components/OrderTypeSelector';
import { PickupTimeSelector } from '@/components/PickupTimeSelector';
import { useOrders } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { getEffectiveBasePrice } from '@/lib/promo';

export function CartView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createOrder } = useOrders();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    totalPrice, 
    selectedRestaurant,
    orderType,
    setOrderType,
    pickupTime,
    setPickupTime,
    deliveryAddress,
    setDeliveryAddress,
    clearCart
  } = useCart();

  const { getClosureForSite } = useActiveClosures();

  const now = new Date();
  const isMonday = now.getDay() === 1;
  const currentHour = now.getHours();
  const isOutsideHours = currentHour < 18 || currentHour >= 22;
  const manualClosure = selectedRestaurant ? getClosureForSite(selectedRestaurant.name) : null;
  const isClosed = isMonday || isOutsideHours || !!manualClosure;

  const canCheckout = () => {
    if (isClosed) return false;
    if (items.length === 0) return false;
    if (!selectedRestaurant) return false;
    if (orderType === 'emporter' && !pickupTime) return false;
    if (orderType === 'livraison' && !deliveryAddress) return false;
    return true;
  };

  const handleSubmitOrder = async () => {
    if (!user) {
      toast({
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour passer commande',
        variant: 'destructive'
      });
      navigate('/auth');
      return;
    }

    if (!canCheckout() || !selectedRestaurant) return;

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        restaurant: selectedRestaurant.name,
        order_type: orderType,
        items: items,
        total_price: totalPrice,
        pickup_time: pickupTime,
        delivery_address: deliveryAddress,
      });

      clearCart();
      navigate(`/order-confirmation?id=${order.id}`);
    } catch (error) {
      console.error('Error submitting order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {/* Closed alerts */}
      {manualClosure && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Commandes bloquées</p>
            <p className="text-sm text-muted-foreground mt-1">{manualClosure.reason}</p>
            {manualClosure.end_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Jusqu'au {new Date(manualClosure.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}
      {!manualClosure && isMonday && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Fermé le lundi</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nos pizzerias sont fermées le lundi. Revenez dès demain mardi pour passer votre commande ! 🍕
            </p>
          </div>
        </div>
      )}
      {!manualClosure && !isMonday && isOutsideHours && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Hors horaires d'ouverture</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nos pizzerias sont ouvertes de <strong className="text-primary">18h à 22h</strong>. Revenez pendant nos horaires d'ouverture pour commander ! 🕐
            </p>
          </div>
        </div>
      )}
      {selectedRestaurant && (
        <div className="glass-card p-4 mb-2">
          <p className="text-sm text-muted-foreground">Commande pour</p>
          <p className="font-display font-bold text-primary">{selectedRestaurant.name}</p>
        </div>
      )}

      {/* Order Type Selection */}
      <div className="glass-card p-4">
        <OrderTypeSelector 
          value={orderType} 
          onChange={setOrderType}
        />
      </div>

      {/* Delivery Flow */}
      {orderType === 'livraison' && (
        <div className="glass-card p-4">
          <DeliveryZoneChecker 
            onValidAddress={(address, coordinates) => {
              setDeliveryAddress({ address, coordinates });
            }}
          />
          {deliveryAddress && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-600">Adresse de livraison</p>
                <p className="text-sm text-muted-foreground">{deliveryAddress.address}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pickup Flow */}
      {orderType === 'emporter' && (
        <div className="glass-card p-4">
          <PickupTimeSelector 
            value={pickupTime}
            onChange={setPickupTime}
          />
        </div>
      )}

      {/* Cart Items */}
      <div className="pt-2">
        <h3 className="font-display font-semibold text-foreground mb-3">Votre commande</h3>
        {items.map((item, index) => {
          const itemTotal =
            (getEffectiveBasePrice(item.pizza.basePrice, item.size.id) +
              item.size.price +
              item.supplements.reduce((sum, s) => sum + s.price, 0)) *
            item.quantity;

          return (
            <div key={index} className="glass-card p-4 flex gap-4 mb-3">
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
      </div>

      {/* Fixed bottom checkout */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-foreground">Total</span>
            <span className="text-2xl font-display font-bold text-primary">
              {totalPrice.toFixed(2)}€
            </span>
          </div>
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full"
            disabled={!canCheckout() || isSubmitting}
            onClick={handleSubmitOrder}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : manualClosure ? (
              'Commandes bloquées'
            ) : isMonday ? (
              'Fermé le lundi'
            ) : isOutsideHours ? (
              'Ouvert de 18h à 22h'
            ) : !user ? (
              'Se connecter pour commander'
            ) : orderType === 'livraison' && !deliveryAddress ? (
              'Vérifiez votre adresse'
            ) : orderType === 'emporter' && !pickupTime ? (
              'Choisissez une heure'
            ) : (
              'Commander maintenant'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
