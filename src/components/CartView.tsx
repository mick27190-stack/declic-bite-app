import { useState, useEffect } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { DeliveryZoneChecker } from '@/components/DeliveryZoneChecker';
import { ProductImage } from '@/components/ProductImage';

import { OrderTypeSelector } from '@/components/OrderTypeSelector';
import { PickupTimeSelector } from '@/components/PickupTimeSelector';
import { DeliveryTimeSelector } from '@/components/DeliveryTimeSelector';
import { useOrders } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { getPizzaSizePrice, getNonPizzaPrice } from '@/lib/pricing';
import { validateDeliverySlot } from '@/lib/pickupSlots';

import {
  getCutoffState,
  getCutoffButtonLabel,
  getCutoffWarningMinutesRemaining,
} from '@/lib/orderCutoff';

export function CartView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { createOrder } = useOrders({ autoFetch: false });
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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Update the countdown every 30s so the CTA button reflects the remaining
    // minutes until the 21h15 cut-off during the 21h00-21h15 warning window.
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const isMonday = now.getDay() === 1;
  const currentHour = now.getHours();
  const isOutsideHours = currentHour < 18 || currentHour >= 22;
  const manualClosure = selectedRestaurant ? getClosureForSite(selectedRestaurant.name) : null;
  const isClosed = isMonday || isOutsideHours || !!manualClosure;
  // Take-away is blocked after 21h30 (Paris) on open days, so the last valid
  // pickup slot (21h30) can still be honoured before the kitchen closes at 22h.
  // Delivery is blocked from 21h16 (Paris) — last accepted order at 21h15.
  // From 21h00 to 21h15 the CTA shows a warning that orders close at 21h15.
  const cutoff = getCutoffState(now, isClosed);
  const warningMinutes = getCutoffWarningMinutesRemaining(now);


  // Minimum order check for delivery outside the restaurant's own commune:
  // 2 pizzas Senior OU 1 pizza Méga (ou plus) requis.
  // Conches -> Conches-en-Ouche, Beaumont -> Beaumont-le-Roger.
  // A postal code alone is NOT reliable: 27190 spans many villages around
  // Conches, so we match on the commune (city) and fall back to postal code.
  const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];
  const localCity = selectedRestaurant?.id === 'conches'
    ? 'conches-en-ouche'
    : selectedRestaurant?.id === 'beaumont'
      ? 'beaumont-le-roger'
      : null;
  const localPostalCode = selectedRestaurant?.id === 'conches'
    ? '27190'
    : selectedRestaurant?.id === 'beaumont'
      ? '27170'
      : null;
  const normalize = (s?: string | null) => (s ?? '').toLowerCase().trim();
  const addressCity = normalize(deliveryAddress?.city);
  // Local only when the delivery commune matches the restaurant's own town.
  // If the geocoder did not return a city, fall back to the postal code check.
  const isLocalDelivery = !!deliveryAddress && (
    addressCity
      ? addressCity === localCity
      : !!deliveryAddress.postalCode && deliveryAddress.postalCode === localPostalCode
  );
  const needsMinimum = orderType === 'livraison' && !!deliveryAddress && !isLocalDelivery;
  // Only real pizzas count. Pizza size equivalents: senior = 1, mega/super-mega = 2 (1 méga = 2 seniors)
  const pizzaEquivalents = items.reduce((sum, item) => {
    if (!PIZZA_CATEGORIES.includes(item.pizza.category)) return sum;
    const unit = item.size.id === 'senior' ? 1 : 2;
    return sum + unit * item.quantity;
  }, 0);
  const belowMinimum = needsMinimum && pizzaEquivalents < 2;
  // Address not yet validated for the selected delivery site.
  const needsAddress = orderType === 'livraison' && !deliveryAddress;

  const canCheckout = () => {
    if (isClosed) return false;
    if (items.length === 0) return false;
    if (!selectedRestaurant) return false;
    if (orderType === 'emporter' && !pickupTime) return false;
    if (orderType === 'emporter' && cutoff.isTakeawayCutoff) return false;
    if (orderType === 'livraison' && !deliveryAddress) return false;
    if (orderType === 'livraison' && !pickupTime) return false;
    // Mirror the backend rule: the delivery slot must be on the 18h45 → 21h45
    // grid and never before max(now + 30 min, 18h45).
    if (orderType === 'livraison' && !validateDeliverySlot(pickupTime, now).valid) return false;
    if (orderType === 'livraison' && cutoff.isDeliveryCutoff) return false;

    if (belowMinimum) return false;
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

    if (orderType === 'livraison') {
      // Re-check against the live Paris clock right before sending, so a slot
      // that expired while the cart was open is caught here and not by the API.
      const slotCheck = validateDeliverySlot(pickupTime, new Date());
      if (!slotCheck.valid) {
        toast({
          title: 'Créneau de livraison indisponible',
          description: slotCheck.error,
          variant: 'destructive',
        });
        setPickupTime('');
        return;
      }
    }


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
            <p className="text-sm text-foreground mt-1">{manualClosure.reason}</p>

          </div>
        </div>
      )}
      {!manualClosure && isMonday && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Fermé le lundi</p>
            <p className="text-sm text-foreground mt-1">
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
            <p className="text-sm text-foreground mt-1">
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
          disabled={isClosed}
          takeawayDisabled={cutoff.isTakeawayCutoff}
          deliveryDisabled={cutoff.isDeliveryCutoff}
        />
      </div>


      {/* Delivery Flow */}
      {orderType === 'livraison' && (
        <div className="glass-card p-4">
          <DeliveryZoneChecker 
            disabled={isClosed}
            onValidAddress={(address, coordinates, postalCode, city) => {
              setDeliveryAddress({ address, coordinates, postalCode, city });
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

      {/* Delivery time selection */}
      {orderType === 'livraison' && deliveryAddress && !isClosed && (
        <div className="glass-card p-4">
          <DeliveryTimeSelector
            value={pickupTime}
            onChange={setPickupTime}
            disabled={isClosed}
          />
        </div>
      )}

      {/* Address not validated alert for delivery */}
      {needsAddress && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-700 text-sm">Adresse non validée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Validez une adresse de livraison pour le site sélectionné avant de commander.
            </p>
          </div>
        </div>
      )}

      {/* Minimum order alert for delivery outside local cities */}
      {belowMinimum && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-700 text-sm">Minimum de commande requis</p>
            <p className="text-sm text-muted-foreground mt-1">
              <strong className="text-primary">Hors Site, un minimum de 2 pizzas seniors ou 1 pizza Mega est requis en livraison</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ajoutez des pizzas à votre panier pour atteindre le minimum requis.
            </p>
          </div>
        </div>
      )}

      {/* Orders closed after the evening cut-off */}
      {(cutoff.isTakeawayCutoff || cutoff.isDeliveryCutoff) && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-700 text-sm">Commandes fermées</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les commandes à emporter et en livraison sont fermées. Revenez{' '}
              {isSundayParis ? 'mardi' : 'demain'} à partir de 18h00.
            </p>
          </div>
        </div>
      )}

      {/* Pickup Flow */}
      {orderType === 'emporter' && !cutoff.isTakeawayCutoff && (
        <div className="glass-card p-4">
          <PickupTimeSelector 
            value={pickupTime}
            onChange={setPickupTime}
            disabled={isClosed}
          />
        </div>
      )}


      {/* Cart Items */}
      <div className="pt-2">
        <h3 className="font-display font-semibold text-foreground mb-3">Votre commande</h3>
        {items.map((item, index) => {
          const isPizzaItem = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'].includes(item.pizza.category);
          const itemBase = isPizzaItem
            ? getPizzaSizePrice(item.size.id, item.pizza.category)
            : getNonPizzaPrice(item.pizza, item.size);
          const itemTotal =
            (itemBase + item.supplements.reduce((sum, s) => sum + s.price, 0)) *
            item.quantity;

          return (
            <div key={index} className="glass-card p-4 flex gap-4 mb-3">
              <ProductImage
                src={item.pizza.image}
                alt={item.pizza.name}
                className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
              />

              
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-foreground truncate">
                  {item.pizza.name}
                </h3>
                {item.pizza.category === 'bambino' && item.pizza.description?.startsWith('Menu Bambino - ') && (
                  <p className="text-xs text-primary font-semibold">
                    🍕 {item.pizza.description.replace('Menu Bambino - ', '')}
                  </p>
                )}
                {item.pizza.category !== 'boissons' && (
                  <p className="text-sm text-muted-foreground">
                    {item.pizza.category === 'bambino' ? 'Bambino' : item.size.name} • Base {item.base}
                  </p>
                )}

                {item.supplements.length > 0 && (
                  <p className="text-xs text-primary">
                    + {item.supplements.map((s) => s.name).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    📝 {item.notes}
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
            className="w-full h-auto min-h-14 py-2 px-3 sm:px-6 whitespace-normal text-sm sm:text-base lg:text-lg leading-tight text-balance"
            disabled={!canCheckout() || isSubmitting}
            onClick={handleSubmitOrder}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : cutoff.isCutoffWarning && warningMinutes !== null ? (
              <span className="flex flex-col items-center justify-center gap-0.5">
                <span>Commandes jusqu’à 21h15</span>
                <span className="text-xs sm:text-sm opacity-90 font-normal">
                  encore {warningMinutes} min
                </span>
              </span>
            ) : (
              getCutoffButtonLabel(cutoff, { orderType, canCheckout: canCheckout() }) ??
              (manualClosure ? (
                'Commandes bloquées'
              ) : isMonday ? (
                'Fermé le lundi'
              ) : isOutsideHours ? (
                'Ouvert de 18h à 22h'
              ) : !selectedRestaurant ? (
                'Choisissez un restaurant'
              ) : !user ? (
                'Se connecter pour commander'
              ) : orderType === 'livraison' && !deliveryAddress ? (
                'Vérifiez votre adresse'
              ) : belowMinimum ? (
                'Min. 2 Senior ou 1 Méga'
              ) : orderType === 'emporter' && !pickupTime ? (
                'Choisissez une heure'
              ) : orderType === 'livraison' && !pickupTime ? (
                'Choisissez une heure'
              ) : (
                'Commander maintenant'
              ))
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
