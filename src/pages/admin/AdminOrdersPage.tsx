import { useNavigate } from 'react-router-dom';
import NotificationBell from '@/components/admin/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, MapPin, RefreshCw, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { OrderStatus, statusLabels, statusColors } from '@/types/order';

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageOrders, isSiteAdminConches, isSiteAdminBeaumont, isSuperAdmin, loading: adminLoading } = useAdmin();
  const { orders, loading: ordersLoading, updateOrderStatus, setDeliveryEstimate, refetch } = useOrders();
  
  const [filterSite, setFilterSite] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');

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
                          <SelectItem value="delivered">Livrée</SelectItem>
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
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(Array.isArray(order.items) ? order.items : []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item?.quantity ?? 1}x {item?.pizza?.name ?? 'Produit'} ({item?.size?.name ?? '-'})
                            {item?.supplements?.length > 0 && (
                              <span className="text-muted-foreground">
                                {' '}+ {item.supplements.map((s: any) => s.name).join(', ')}
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
