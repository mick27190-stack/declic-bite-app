import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, MapPin, Phone, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';

interface Order {
  id: string;
  customerName: string;
  phone: string;
  items: { name: string; size: string; quantity: number; price: number }[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  orderType: 'delivery' | 'pickup';
  address?: string;
  pickupTime?: string;
  createdAt: string;
  site: 'conches' | 'beaumont';
}

// Mock data for demonstration
const mockOrders: Order[] = [
  {
    id: '1',
    customerName: 'Jean Dupont',
    phone: '+33612345678',
    items: [
      { name: 'Margherita', size: 'Méga', quantity: 2, price: 40 },
      { name: 'Carnivore', size: 'Senior', quantity: 1, price: 13 }
    ],
    total: 53,
    status: 'pending',
    orderType: 'delivery',
    address: '12 rue de la Paix, 27190 Conches-en-Ouche',
    createdAt: new Date().toISOString(),
    site: 'conches'
  },
  {
    id: '2',
    customerName: 'Marie Martin',
    phone: '+33698765432',
    items: [
      { name: 'Végétarienne', size: 'Super Méga', quantity: 1, price: 28 }
    ],
    total: 28,
    status: 'preparing',
    orderType: 'pickup',
    pickupTime: '19:30',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    site: 'beaumont'
  }
];

const statusLabels: Record<Order['status'], string> = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prête',
  delivered: 'Livrée',
  cancelled: 'Annulée'
};

const statusColors: Record<Order['status'], string> = {
  pending: 'bg-yellow-500',
  preparing: 'bg-blue-500',
  ready: 'bg-green-500',
  delivered: 'bg-gray-500',
  cancelled: 'bg-red-500'
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canManageOrders, isSiteAdminConches, isSiteAdminBeaumont, isSuperAdmin, loading: adminLoading } = useAdmin();
  
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filterSite, setFilterSite] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | Order['status']>('all');

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!canManageOrders) {
        navigate('/admin');
      }
    }
  }, [user, canManageOrders, authLoading, adminLoading]);

  const filteredOrders = orders.filter(order => {
    if (filterSite !== 'all' && order.site !== filterSite) return false;
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    
    // Filter by site if not super admin
    if (!isSuperAdmin) {
      if (isSiteAdminConches && order.site !== 'conches') return false;
      if (isSiteAdminBeaumont && order.site !== 'beaumont') return false;
    }
    
    return true;
  });

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, status: newStatus } : o
    ));
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
          <div>
            <h1 className="text-xl font-bold text-primary">Gestion des Commandes</h1>
            <p className="text-sm text-muted-foreground">Suivre et gérer les commandes</p>
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
              <SelectItem value="preparing">En préparation</SelectItem>
              <SelectItem value="ready">Prête</SelectItem>
              <SelectItem value="delivered">Livrée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune commande trouvée
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">Commande #{order.id}</CardTitle>
                      <Badge className={statusColors[order.status]}>
                        {statusLabels[order.status]}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {order.site}
                      </Badge>
                    </div>
                    <Select 
                      value={order.status} 
                      onValueChange={(v) => updateOrderStatus(order.id, v as Order['status'])}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="preparing">En préparation</SelectItem>
                        <SelectItem value="ready">Prête</SelectItem>
                        <SelectItem value="delivered">Livrée</SelectItem>
                        <SelectItem value="cancelled">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <CardDescription className="flex flex-wrap gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {order.customerName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {order.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {order.orderType === 'delivery' && order.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {order.address}
                      </span>
                    )}
                    {order.orderType === 'pickup' && order.pickupTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Retrait à {order.pickupTime}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name} ({item.size})</span>
                        <span className="font-medium">{item.price}€</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span>{order.total}€</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
