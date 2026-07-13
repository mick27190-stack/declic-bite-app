import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from '@/components/admin/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ArrowLeft, RefreshCw, History, Package, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { statusLabels, statusColors, OrderStatus } from '@/types/order';

interface HistoryOrder {
  id: string;
  restaurant: string;
  order_type: 'emporter' | 'livraison';
  status: OrderStatus;
  total_price: number;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

interface HistoryWeek {
  id: string;
  week_start: string;
  week_end: string;
  order_count: number;
  total_revenue: number;
  orders: HistoryOrder[];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminOrderHistoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { canManageOrders, loading: adminLoading } = useAdmin();

  const [weeks, setWeeks] = useState<HistoryWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('order_history')
      .select('*')
      .order('week_start', { ascending: false });

    if (error) {
      console.error('Error fetching order history:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de charger l'historique des commandes",
        variant: 'destructive',
      });
    } else {
      setWeeks((data || []) as unknown as HistoryWeek[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!canManageOrders) navigate('/');
    }
  }, [user, canManageOrders, authLoading, adminLoading, navigate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                <History className="h-5 w-5" /> Historique des commandes
              </h1>
              <p className="text-sm text-muted-foreground">Archivé chaque lundi à 3h00</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : weeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucune semaine archivée pour le moment.</p>
              <p className="text-sm mt-1">
                Les commandes seront archivées automatiquement chaque lundi à 3h00.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {weeks.map((week) => (
              <AccordionItem
                key={week.id}
                value={week.id}
                className="border rounded-lg bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between pr-4 text-left">
                    <div>
                      <p className="font-semibold">
                        Semaine du {formatDate(week.week_start)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        au {formatDate(week.week_end)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Package className="h-3 w-3" /> {week.order_count}
                      </Badge>
                      <span className="font-bold text-primary whitespace-nowrap">
                        {Number(week.total_revenue).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {week.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Aucune commande cette semaine.
                    </p>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {week.orders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              #{order.id.slice(0, 8)}
                              {order.customer_name ? ` · ${order.customer_name}` : ''}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(order.created_at).toLocaleString('fr-FR')} ·{' '}
                              {order.restaurant} ·{' '}
                              {order.order_type === 'livraison' ? 'Livraison' : 'À emporter'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`${statusColors[order.status]} text-white`}>
                              {statusLabels[order.status]}
                            </Badge>
                            <span className="font-semibold whitespace-nowrap">
                              {Number(order.total_price).toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>
    </div>
  );
}
