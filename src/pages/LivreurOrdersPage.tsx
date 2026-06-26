import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, MapPin, RefreshCw, Package, Bike, CheckCircle2, Phone } from 'lucide-react';
import { statusLabels, statusColors } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';

// Plage horaire du livreur : 18h - 23h30 (heure de Paris).
function isLivreurWindowOpen(): boolean {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const minutes = hour * 60 + minute;
  return minutes >= 18 * 60 && minutes <= 23 * 60 + 30;
}

export default function LivreurOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAnyLivreur, livreurSite, loading: adminLoading } = useAdmin();
  const { orders, loading: ordersLoading, updateOrderStatus, refetch } = useOrders();

  const [windowOpen, setWindowOpen] = useState(isLivreurWindowOpen());

  useEffect(() => {
    const interval = setInterval(() => setWindowOpen(isLivreurWindowOpen()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAnyLivreur) {
        navigate('/');
      }
    }
  }, [user, isAnyLivreur, authLoading, adminLoading, navigate]);

  // RLS limite déjà la liste aux commandes en livraison du site du livreur.
  // On garde uniquement les commandes en cours (ni livrées, ni annulées).
  const activeOrders = orders.filter(
    (o) => o.order_type === 'livraison' && o.status !== 'delivered' && o.status !== 'cancelled',
  );

  // Récupère le téléphone des clients pour les commandes affichées.
  const [phones, setPhones] = useState<Record<string, string>>({});
  useEffect(() => {
    const userIds = Array.from(new Set(activeOrders.map((o) => o.user_id)));
    if (userIds.length === 0) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('user_id, phone')
      .in('user_id', userIds)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, string> = {};
        data.forEach((p: { user_id: string; phone: string | null }) => {
          if (p.phone) map[p.user_id] = p.phone;
        });
        setPhones(map);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders.map((o) => o.user_id).join(',')]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              <Bike className="h-5 w-5" /> Espace Livreur
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              Livraisons en cours{livreurSite ? ` • ${livreurSite}` : ''}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={refetch} disabled={ordersLoading}>
            <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!windowOpen && (
          <Card className="mb-6 border-amber-500/50">
            <CardContent className="py-4 text-center text-foreground">
              L'espace livreur est disponible de 18h à 23h30.
            </CardContent>
          </Card>
        )}

        {ordersLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : activeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Aucune livraison en cours</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">#{order.id.slice(0, 8)}</CardTitle>
                      <Badge className={statusColors[order.status]}>
                        {statusLabels[order.status]}
                      </Badge>
                      <Badge variant="secondary">🚗 Livraison</Badge>
                    </div>
                  </div>
                  <CardDescription className="flex flex-col gap-2 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {new Date(order.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {order.delivery_address && (
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <MapPin className="h-4 w-4" />
                        {order.delivery_address.address}
                      </span>
                    )}
                    {phones[order.user_id] && (
                      <a
                        href={`tel:${phones[order.user_id].replace(/\s/g, '')}`}
                        className="flex items-center gap-1 text-primary font-medium underline underline-offset-2"
                      >
                        <Phone className="h-4 w-4" />
                        {phones[order.user_id]}
                      </a>
                    )}
                    {order.delivery_estimate && (
                      <span className="text-xs">Horaire proposé : {order.delivery_estimate}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-lg">{order.total_price.toFixed(2)} €</span>
                    <Button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Marquer comme livré
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
