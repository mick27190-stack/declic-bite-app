import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus, statusLabels } from '@/types/order';
import { CartItem } from '@/types/pizza';
import { useToast } from '@/hooks/use-toast';

/** Une commande n'est visible côté admin qu'une fois le paiement autorisé
 *  (capture_status renseigné par Stripe). Les commandes historiques, créées
 *  avant Stripe, restent visibles tant qu'elles ne sont pas en attente. */
export function isOrderPaymentAuthorized(record: { capture_status?: string | null; status?: string | null }) {
  // Autorisation annulée (Stripe) : la commande ne doit plus apparaître en admin.
  if (record.capture_status === 'cancelled' || record.capture_status === 'canceled') return false;
  // Paiement pas encore autorisé par la banque (en attente du webhook Stripe).
  if (record.capture_status === 'pending') return false;
  if (record.capture_status) return true;
  return record.status !== 'pending';
}

export function useOrders(options: { autoFetch?: boolean } = {}) {
  const { autoFetch = true } = options;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    try {
      const { data: rawData, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Seules les commandes dont le paiement est autorisé remontent en admin.
      const data = (rawData || []).filter((o: any) => isOrderPaymentAuthorized(o));


      // Fetch matching profiles separately (no FK relationship available)
      const userIds = Array.from(
        new Set((data || []).map((o: any) => o.user_id).filter(Boolean))
      );
      const profileMap = new Map<string, { first_name?: string; last_name?: string; phone?: string }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, phone')
          .in('user_id', userIds);
        (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));
      }

      // Transform the data to match our Order type
      const transformedOrders: Order[] = (data || []).map((order: any) => {
        const profile = order.user_id ? profileMap.get(order.user_id) : undefined;
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
        title: 'Commande enregistrée',
        description: 'Dernière étape : autorisez le paiement pour la transmettre au restaurant',
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

      // Fire off email to the customer (if they have an email on file).
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('user_id, pickup_time')
          .eq('id', orderId)
          .single();

        if (order?.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', order.user_id)
            .maybeSingle();

          const email = profile?.email?.trim();
          if (email) {
            const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

            // Fetch the one-click response tokens generated by the trigger.
            const { data: tokens } = await supabase
              .from('delivery_response_tokens')
              .select('token, action')
              .eq('order_id', orderId)
              .is('used_at', null);

            const projectRef = 'tzamsbbpygevsdvugdbv';
            const base = `https://${projectRef}.supabase.co/functions/v1/handle-delivery-response`;
            const acceptTok = tokens?.find(t => t.action === 'accepted')?.token;
            const refuseTok = tokens?.find(t => t.action === 'refused')?.token;

            await supabase.functions.invoke('send-transactional-email', {
              body: {
                templateName: 'delivery-estimate',
                recipientEmail: email,
                idempotencyKey: `delivery-estimate-${orderId}-${estimate}`,
                templateData: {
                  customerName: fullName || undefined,
                  requestedTime: order.pickup_time || undefined,
                  estimatedTime: estimate,
                  acceptUrl: acceptTok ? `${base}?token=${acceptTok}` : undefined,
                  refuseUrl: refuseTok ? `${base}?token=${refuseTok}` : undefined,
                },
              },
            });
          }
        }
      } catch (mailErr) {
        console.error('Delivery estimate email failed:', mailErr);
      }

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
    if (!autoFetch) return;
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
            if (!isOrderPaymentAuthorized(payload.new as any)) return;
            void (async () => {
              const newOrder = await buildOrder(payload.new);
              setOrders(prev => prev.some(o => o.id === newOrder.id) ? prev : [newOrder, ...prev]);
              toast({
                title: '🔔 Nouvelle commande !',
                description: `Commande de ${newOrder.total_price.toFixed(2)}€`,
              });
            })();
          } else if (payload.eventType === 'UPDATE') {
            if (!isOrderPaymentAuthorized(payload.new as any)) {
              setOrders(prev => prev.filter(o => o.id !== (payload.new as any).id));
              return;
            }
            void (async () => {
              const updatedOrder = await buildOrder(payload.new);
              let isNewArrival = false;
              setOrders(prev => {
                if (prev.some(o => o.id === updatedOrder.id)) {
                  return prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o));
                }
                isNewArrival = true;
                return [updatedOrder, ...prev];
              });
              // Le paiement vient d'être autorisé : la commande arrive en cuisine.
              if (isNewArrival) {
                toast({
                  title: '🔔 Nouvelle commande !',
                  description: `Commande de ${updatedOrder.total_price.toFixed(2)}€`,
                });
              }
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
  }, [autoFetch, fetchOrders, toast]);

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
      // L'Edge Function pilote aussi Stripe : capture si accepté,
      // annulation de la pré-autorisation si refusé.
      const { data, error } = await supabase.functions.invoke('respond-to-delivery-time', {
        body: { order_id: orderId, response },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

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
