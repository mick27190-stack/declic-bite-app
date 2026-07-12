import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus, statusLabels } from '@/types/order';
import { CartItem } from '@/types/pizza';
import { useToast } from '@/hooks/use-toast';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, profiles:user_id(first_name, last_name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our Order type
      const transformedOrders: Order[] = (data || []).map((order: any) => {
        const profile = order.profiles;
        return {
          ...order,
          customer_name: profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || undefined
            : undefined,
          customer_phone: profile?.phone ?? undefined,
          order_type: order.order_type as 'emporter' | 'livraison',
          delivery_response: order.delivery_response as Order['delivery_response'],
          items: order.items as unknown as CartItem[],
          delivery_address: order.delivery_address as Order['delivery_address'],
        };
      });

      setOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les commandes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createOrder = async (orderData: {
    restaurant: string;
    order_type: 'emporter' | 'livraison';
    items: CartItem[];
    total_price: number;
    pickup_time?: string | null;
    delivery_address?: { address: string; coordinates: { lat: number; lng: number } } | null;
    notes?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Vous devez être connecté pour passer une commande');
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          restaurant: orderData.restaurant,
          order_type: orderData.order_type,
          items: orderData.items as unknown as any,
          total_price: orderData.total_price,
          pickup_time: orderData.pickup_time || null,
          delivery_address: orderData.delivery_address || null,
          notes: orderData.notes || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Commande envoyée !',
        description: 'Votre commande a été transmise au restaurant',
      });

      return data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer la commande',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status } : o
      ));

      toast({
        title: 'Statut mis à jour',
        description: `La commande est maintenant "${status}"`,
      });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
        variant: 'destructive'
      });
    }
  };

  const setDeliveryEstimate = async (orderId: string, estimate: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivery_estimate: estimate, delivery_response: null })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, delivery_estimate: estimate, delivery_response: null } : o
      ));

      toast({
        title: 'Horaire envoyé',
        description: `Horaire de livraison proposé : ${estimate}`,
      });
    } catch (error) {
      console.error('Error setting delivery estimate:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'envoyer l'horaire de livraison",
        variant: 'destructive'
      });
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change:', payload);

          const buildOrder = async (record: Record<string, any>): Promise<Order> => {
            const base: Order = {
              ...(record as Order),
              order_type: record.order_type as 'emporter' | 'livraison',
              delivery_response: record.delivery_response as Order['delivery_response'],
              items: record.items as unknown as CartItem[],
              delivery_address: record.delivery_address as Order['delivery_address'],
            };
            if (record.user_id) {
              try {
                const { data } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, phone')
                  .eq('user_id', record.user_id)
                  .single();
                if (data) {
                  base.customer_name = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || undefined;
                  base.customer_phone = data.phone ?? undefined;
                }
              } catch {
                // ignore missing profile
              }
            }
            return base;
          };

          if (payload.eventType === 'INSERT') {
            void (async () => {
              const newOrder = await buildOrder(payload.new);
              setOrders(prev => [newOrder, ...prev]);
              toast({
                title: '🔔 Nouvelle commande !',
                description: `Commande de ${newOrder.total_price.toFixed(2)}€`,
              });
            })();
          } else if (payload.eventType === 'UPDATE') {
            void (async () => {
              const updatedOrder = await buildOrder(payload.new);
              setOrders(prev => prev.map(o =>
                o.id === updatedOrder.id ? updatedOrder : o
              ));
            })();
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, toast]);

  return {
    orders,
    loading,
    createOrder,
    updateOrderStatus,
    setDeliveryEstimate,
    refetch: fetchOrders
  };
}

export function useUserOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUserOrders = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        const transformedOrders: Order[] = (data || []).map(order => ({
          ...order,
          order_type: order.order_type as 'emporter' | 'livraison',
          delivery_response: order.delivery_response as Order['delivery_response'],
          items: order.items as unknown as CartItem[],
          delivery_address: order.delivery_address as Order['delivery_address'],
        }));

        setOrders(transformedOrders);
      } catch (error) {
        console.error('Error fetching user orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserOrders();

    // Keeps only the 10 most recent orders in local state.
    const trimOrders = (list: Order[]) => {
      return list
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
    };

    // Subscribe to user's order updates
    let channel: ReturnType<typeof supabase.channel>;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      channel = supabase
        .channel('user-orders-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newRecord = payload.new as Record<string, any>;
            const updatedOrder = {
              ...newRecord,
              order_type: newRecord.order_type as 'emporter' | 'livraison',
              items: newRecord.items as unknown as CartItem[],
              delivery_address: newRecord.delivery_address as Order['delivery_address'],
            } as Order;

            if (payload.eventType === 'INSERT') {
              setOrders(prev => {
                // Avoid duplicates and keep only the 10 most recent orders
                if (prev.find(o => o.id === updatedOrder.id)) return prev;
                return trimOrders([updatedOrder, ...prev]);
              });
              toast({
                title: 'Nouvelle commande',
                description: `Votre commande #${updatedOrder.id.slice(0, 8)} a été créée`,
              });
            } else if (payload.eventType === 'UPDATE') {
              setOrders(prev => {
                const exists = prev.find(o => o.id === updatedOrder.id);
                if (exists) {
                  toast({
                    title: 'Commande mise à jour',
                    description: `Votre commande est maintenant "${statusLabels[updatedOrder.status]}"`,
                  });
                  return trimOrders(prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                }
                return prev;
              });
            } else if (payload.eventType === 'DELETE') {
              setOrders(prev => trimOrders(prev.filter(o => o.id !== payload.old.id)));
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [toast]);

  const respondToOrder = async (orderId: string, response: 'accepted' | 'refused') => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ delivery_response: response })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, delivery_response: response }
          : o
      ));

      toast({
        title: response === 'accepted' ? 'Horaire accepté' : 'Commande refusée',
        description: response === 'accepted'
          ? 'Merci ! Votre commande est confirmée.'
          : 'Votre commande a été annulée.',
      });
    } catch (error) {
      console.error('Error responding to order:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer votre réponse',
        variant: 'destructive'
      });
    }
  };

  return { orders, loading, respondToOrder };
}
