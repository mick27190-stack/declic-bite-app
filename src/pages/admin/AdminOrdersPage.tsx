import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/admin/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, MapPin, RefreshCw, Package, Phone, Printer, MessageCircle, Send, FileText, Loader2 } from 'lucide-react';
import OrderTicket from '@/components/OrderTicket';
import { generateInvoicePdf, buildInvoiceNumber } from '@/lib/invoicePdf';
import { useCompanyInfo, resolveCompanyForRestaurant } from '@/hooks/useCompanyInfo';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderStatus, statusLabels, statusColors } from '@/types/order';

function DeliveryEstimateControl({ order, onSubmit }: { order: Order; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(order.delivery_estimate ?? '');

  const responseLabel = order.delivery_response === 'accepted'
    ? '✅ Accepté par le client'
    : order.delivery_response === 'refused'
      ? '❌ Refusé par le client'
      : order.delivery_estimate
        ? '⏳ En attente de réponse du client'
        : null;

  return (
    <div className="mt-4 border-t pt-3 space-y-2">
      <p className="text-sm font-medium flex items-center gap-1">
        <Clock className="h-4 w-4" /> Horaire de livraison estimé
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex : 45 min ou 20h30"
          className="h-9"
        />
        <Button
          size="sm"
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
        >
          Envoyer
        </Button>
      </div>
      {responseLabel && (
        <p className="text-xs text-muted-foreground">{responseLabel}</p>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageOrders, isSiteAdminConches, isSiteAdminBeaumont, isSuperAdmin, loading: adminLoading } = useAdmin();
  const { orders, loading: ordersLoading, updateOrderStatus, setDeliveryEstimate, refetch } = useOrders();
  const { data: companyData } = useCompanyInfo();
  
  const { toast } = useToast();
  const [filterSite, setFilterSite] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [invoiceSendingId, setInvoiceSendingId] = useState<string | null>(null);
  // Persistent all-time total (archived weeks + current live orders).
  // Not affected by the Monday 4:00 (Paris) purge of past-week live orders.
  const [archivedCount, setArchivedCount] = useState(0);

  useEffect(() => {
    if (!orderToPrint) return;
    const done = () => setOrderToPrint(null);
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [orderToPrint]);

  useEffect(() => {
    let active = true;
    supabase
      .from('order_history')
      .select('order_count')
      .then(({ data }) => {
        if (!active) return;
        const total = (data || []).reduce((sum, r: any) => sum + (r.order_count || 0), 0);
        setArchivedCount(total);
      });
    return () => { active = false; };
  }, [orders.length]);

  const totalOrdersCount = archivedCount + orders.length;

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!canManageOrders) {
        navigate('/admin');
      }
    }
  }, [user, canManageOrders, authLoading, adminLoading, navigate]);

  const getSiteFromRestaurant = (restaurant: string): 'conches' | 'beaumont' => {
    if (restaurant.toLowerCase().includes('conches')) return 'conches';
    if (restaurant.toLowerCase().includes('beaumont')) return 'beaumont';
    return 'conches'; // default
  };

  const filteredOrders = orders.filter(order => {
    const site = getSiteFromRestaurant(order.restaurant);
    
    if (filterSite !== 'all' && site !== filterSite) return false;
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    
    // Filter by site if not super admin
    if (!isSuperAdmin) {
      if (isSiteAdminConches && site !== 'conches') return false;
      if (isSiteAdminBeaumont && site !== 'beaumont') return false;
    }
    
    return true;
  });

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatus(orderId, newStatus);
  };

  const handleSendChat = async () => {
    if (!chatOrder || !user || !chatMessage.trim()) return;
    const site = getSiteFromRestaurant(chatOrder.restaurant);
    setChatSending(true);
    try {
      // Find or create conversation for this customer + site
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('customer_id', chatOrder.user_id)
        .eq('site', site)
        .maybeSingle();

      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created, error: convErr } = await supabase
          .from('chat_conversations')
          .insert({
            customer_id: chatOrder.user_id,
            site,
            customer_name: chatOrder.customer_name ?? 'Client',
            customer_phone: chatOrder.customer_phone ?? null,
          })
          .select('id')
          .single();
        if (convErr || !created) throw convErr ?? new Error('Conversation introuvable');
        conversationId = created.id;
      }

      const content = chatMessage.trim();
      const { error: msgErr } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_type: 'admin',
        content,
        site,
      });
      if (msgErr) throw msgErr;

      await supabase
        .from('chat_conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          hidden_for_admin_at: null,
        })
        .eq('id', conversationId);

      toast({ title: 'Message envoyé', description: 'Le client a été notifié.' });
      setChatMessage('');
      setChatOrder(null);
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || "Impossible d'envoyer le message",
        variant: 'destructive',
      });
    } finally {
      setChatSending(false);
    }
  };




  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Gestion des Commandes</h1>
            <p className="text-sm text-muted-foreground">
              {filteredOrders.length} commande(s) • Temps réel activé
            </p>
            <p className="text-xs text-muted-foreground">
              Total cumulé : {totalOrdersCount} commande(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={refetch} disabled={ordersLoading}>
              <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            </Button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 mb-6">


          {isSuperAdmin && (
            <Select value={filterSite} onValueChange={(v) => setFilterSite(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                <SelectItem value="conches">Conches</SelectItem>
                <SelectItem value="beaumont">Beaumont</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="confirmed">Confirmée</SelectItem>
              <SelectItem value="preparing">En préparation</SelectItem>
              <SelectItem value="ready">Prête</SelectItem>
              <SelectItem value="delivered">Livrée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune commande trouvée</p>
                </CardContent>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">#{order.id.slice(0, 8)}</CardTitle>
                        <Badge className={statusColors[order.status]}>
                          {statusLabels[order.status]}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {getSiteFromRestaurant(order.restaurant)}
                        </Badge>
                        <Badge variant="secondary">
                          {order.order_type === 'livraison' ? '🚗 Livraison' : '🏪 À emporter'}
                        </Badge>
                      </div>
                      <Select 
                        value={order.status} 
                        onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="confirmed">Confirmée</SelectItem>
                          <SelectItem value="preparing">En préparation</SelectItem>
                          <SelectItem value="ready">Prête</SelectItem>
                          {order.order_type === 'livraison' && (
                            <SelectItem value="delivered">Livrée</SelectItem>
                          )}
                          <SelectItem value="cancelled">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <CardDescription className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(order.created_at).toLocaleString('fr-FR', { 
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      {order.order_type === 'livraison' && order.delivery_address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {order.delivery_address.address}
                        </span>
                      )}
                      {order.order_type === 'emporter' && order.pickup_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Retrait à {order.pickup_time}
                        </span>
                      )}
                      {order.order_type === 'livraison' && order.pickup_time && (
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <Clock className="h-4 w-4" />
                          Livraison souhaitée à {order.pickup_time}
                        </span>
                      )}
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone.replace(/\s/g, '')}`}
                          className="flex items-center gap-1 text-primary hover:underline underline-offset-2"
                        >
                          <Phone className="h-4 w-4" />
                          {order.customer_name ? `${order.customer_name} · ` : ''}{order.customer_phone}
                        </a>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(Array.isArray(order.items) ? order.items : []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item?.quantity ?? 1}x {item?.pizza?.name ?? 'Produit'} ({item?.size?.name ?? '-'})
                            {item?.pizza?.category === 'bambino' && item?.pizza?.description && (
                              <span className="block text-xs font-medium text-primary mt-0.5">
                                🍕 {item.pizza.description}
                              </span>
                            )}
                            {item?.supplements?.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}+ {item.supplements.map((s: any) => s.name).join(', ')}
                              </span>
                            )}
                            {item?.notes && (
                              <span className="block text-xs text-muted-foreground mt-0.5 italic">
                                📝 {item.notes}
                              </span>
                            )}
                          </span>
                          <span className="font-medium">
                            {(((item?.pizza?.basePrice ?? 0) + (item?.size?.price ?? 0) + (item?.supplements ?? []).reduce((s: number, sup: any) => s + (sup.price ?? 0), 0)) * (item?.quantity ?? 1)).toFixed(2)}€
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span className="text-primary">{order.total_price.toFixed(2)}€</span>
                      </div>
                    </div>

                    {order.order_type === 'livraison' && (
                      <DeliveryEstimateControl
                        order={order}
                        onSubmit={(value) => setDeliveryEstimate(order.id, value)}
                      />
                    )}

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setChatMessage('');
                          setChatOrder(order);
                        }}
                        disabled={!order.user_id}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderToPrint(order)}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimer le ticket
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      {orderToPrint && (
        <OrderTicket
          order={{
            id: orderToPrint.id,
            created_at: orderToPrint.created_at,
            restaurant: orderToPrint.restaurant,
            order_type: orderToPrint.order_type,
            status: orderToPrint.status,
            total_price: Number(orderToPrint.total_price),
            pickup_time: orderToPrint.pickup_time,
            delivery_estimate: orderToPrint.delivery_estimate,
            delivery_address: orderToPrint.delivery_address,
            notes: orderToPrint.notes,
            items: orderToPrint.items,
            customer_name: orderToPrint.customer_name,
            customer_phone: orderToPrint.customer_phone,
          }}
          company={resolveCompanyForRestaurant(companyData, orderToPrint.restaurant)}
          printOnly
        />
      )}

      <Dialog open={!!chatOrder} onOpenChange={(open) => !open && setChatOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Envoyer un message au client
            </DialogTitle>
            <DialogDescription>
              {chatOrder?.customer_name || 'Client'} · Commande #{chatOrder?.id.slice(0, 8)}
              <br />
              Le message apparaîtra dans le chat du client et dans la section Chat client.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Votre message…"
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChatOrder(null)} disabled={chatSending}>
              Annuler
            </Button>
            <Button onClick={handleSendChat} disabled={!chatMessage.trim() || chatSending}>
              <Send className="h-4 w-4 mr-2" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
