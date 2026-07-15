import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Order, statusLabels } from '@/types/order';
import { CartItem } from '@/types/pizza';
import { getPizzaSizePrice, getNonPizzaPrice } from '@/lib/pricing';

const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

export default function OrderConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching order:', error);
        navigate('/');
        return;
      }

      setOrder({
        ...data,
        order_type: data.order_type as 'emporter' | 'livraison',
        delivery_response: data.delivery_response as Order['delivery_response'],
        items: data.items as unknown as CartItem[],
        delivery_address: data.delivery_address as Order['delivery_address'],
      });
      setLoading(false);
    };

    fetchOrder();

    // Subscribe to order updates
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          setOrder(prev => prev ? {
            ...prev,
            ...payload.new,
            order_type: payload.new.order_type as 'emporter' | 'livraison',
            items: payload.new.items as unknown as CartItem[],
            delivery_address: payload.new.delivery_address as Order['delivery_address'],
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Confirmation</h1>
            <p className="text-sm text-muted-foreground">Commande #{order.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Success Animation */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Commande confirmée !
          </h2>
          <p className="text-muted-foreground">
            Votre commande a été transmise au restaurant
          </p>
        </div>

        {/* Order Status */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Statut</span>
            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary font-medium text-sm">
              {statusLabels[order.status]}
            </span>
          </div>
          
          {order.order_type === 'emporter' && order.pickup_time && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Retrait prévu à {order.pickup_time}</span>
            </div>
          )}
          
          {order.order_type === 'livraison' && order.delivery_address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{order.delivery_address.address}</span>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="glass-card p-4">
          <h3 className="font-display font-bold text-foreground mb-4">Détails de la commande</h3>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.quantity}x {item.pizza.name} ({item.size.name})
                  {item.supplements.length > 0 && (
                    <span className="text-muted-foreground"> + {item.supplements.map((s) => s.name).join(', ')}</span>
                  )}
                  {item.notes && (
                    <span className="block text-xs italic mt-0.5">📝 {item.notes}</span>
                  )}
                </span>
                <span className="font-medium text-foreground">
                  {((item.pizza.basePrice + item.size.price + item.supplements.reduce((s, sup) => s + sup.price, 0)) * item.quantity).toFixed(2)}€
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-3 mt-3 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{order.total_price.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* Restaurant Info */}
        <div className="glass-card p-4">
          <h3 className="font-display font-bold text-foreground mb-2">Restaurant</h3>
          <p className="text-muted-foreground">{order.restaurant}</p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full"
            onClick={() => navigate('/')}
          >
            <Home className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full"
            onClick={() => navigate('/profile')}
          >
            Voir mes commandes
          </Button>
        </div>
      </main>
    </div>
  );
}
