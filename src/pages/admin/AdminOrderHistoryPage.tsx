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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, RefreshCw, History, Package, MapPin, Truck, Store, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { statusLabels, statusColors, OrderStatus } from '@/types/order';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

type SiteFilter = 'all' | 'conches' | 'beaumont';
type OrderTypeFilter = 'all' | 'livraison' | 'emporter';

function orderSite(restaurant: string): 'conches' | 'beaumont' {
  const r = restaurant.toLowerCase();
  if (r.includes('conches')) return 'conches';
  if (r.includes('beaumont')) return 'beaumont';
  return 'conches';
}

function siteLabel(site: SiteFilter) {
  return site === 'all' ? 'Tous les sites' : site === 'conches' ? 'Conches' : 'Beaumont';
}

function orderTypeLabel(type: OrderTypeFilter) {
  return type === 'all' ? 'Tous les types' : type === 'livraison' ? 'Livraison' : 'À emporter';
}

function escapeCsv(value: string | number | undefined) {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportToCsv(
  weeks: HistoryWeek[],
  siteFilter: SiteFilter,
  orderTypeFilter: OrderTypeFilter
) {
  const filterLine = `Filtres;${siteLabel(siteFilter)};${orderTypeLabel(orderTypeFilter)}\n`;
  const summaryHeader = 'Semaine;Commandes;CA (€)\n';
  const summaryRows = weeks
    .map(
      (w) =>
        `${formatDate(w.week_start)} - ${formatDate(w.week_end)};${w.order_count};${w.total_revenue.toFixed(2)}`
    )
    .join('\n');

  const detailHeader = '\n\nDate;Commande;Site;Restaurant;Type;Client;Statut;Total (€)\n';
  const detailRows = weeks
    .flatMap((w) =>
      w.orders.map(
        (o) =>
          `${new Date(o.created_at).toLocaleString('fr-FR')};${o.id.slice(0, 8)};${orderSite(o.restaurant)};${escapeCsv(o.restaurant)};${o.order_type === 'livraison' ? 'Livraison' : 'À emporter'};${escapeCsv(o.customer_name || '-')};${statusLabels[o.status]};${o.total_price.toFixed(2)}`
      )
    )
    .join('\n');

  const csv = '\uFEFF' + filterLine + '\n' + summaryHeader + summaryRows + detailHeader + detailRows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historique-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportToPdf(
  weeks: HistoryWeek[],
  siteFilter: SiteFilter,
  orderTypeFilter: OrderTypeFilter
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text('Historique des commandes', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Filtres : ${siteLabel(siteFilter)} · ${orderTypeLabel(orderTypeFilter)}`, 14, 28);

  const summaryHeaders = [['Semaine', 'Commandes', 'CA (€)']];
  const summaryRows = weeks.map((w) => [
    `${formatDate(w.week_start)} - ${formatDate(w.week_end)}`,
    w.order_count,
    w.total_revenue.toFixed(2) + ' €',
  ]);

  autoTable(doc, {
    head: summaryHeaders,
    body: summaryRows,
    startY: 35,
    theme: 'striped',
    headStyles: { fillColor: [234, 88, 12] },
    styles: { fontSize: 10, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  const detailHeaders = [['Date', 'N°', 'Site', 'Type', 'Client', 'Statut', 'Total']];
  const detailRows = weeks.flatMap((w) =>
    w.orders.map((o) => [
      new Date(o.created_at).toLocaleString('fr-FR'),
      '#' + o.id.slice(0, 8),
      orderSite(o.restaurant),
      o.order_type === 'livraison' ? 'Livraison' : 'À emporter',
      o.customer_name || '-',
      statusLabels[o.status],
      o.total_price.toFixed(2) + ' €',
    ])
  );

  if (detailRows.length > 0) {
    autoTable(doc, {
      head: detailHeaders,
      body: detailRows,
      startY: (doc as any).lastAutoTable.finalY + 10,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 14, right: 14 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        4: { cellWidth: 35 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20 },
      },
    });
  }

  doc.save(`historique-commandes-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AdminOrderHistoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { canManageOrders, loading: adminLoading } = useAdmin();

  const [weeks, setWeeks] = useState<HistoryWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState<SiteFilter>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderTypeFilter>('all');

  const filteredWeeks = weeks
    .map((week) => {
      const filteredOrders = week.orders.filter((o) => {
        const siteMatch = siteFilter === 'all' || orderSite(o.restaurant) === siteFilter;
        const typeMatch = orderTypeFilter === 'all' || o.order_type === orderTypeFilter;
        return siteMatch && typeMatch;
      });
      return {
        ...week,
        orders: filteredOrders,
        order_count: filteredOrders.length,
        total_revenue: filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0),
      };
    })
    .filter((week) => week.order_count > 0 || (siteFilter === 'all' && orderTypeFilter === 'all'));

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
        {!loading && weeks.length > 0 && (
          <div className="space-y-3 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {(['all', 'conches', 'beaumont'] as SiteFilter[]).map((site) => (
                <Button
                  key={site}
                  variant={siteFilter === site ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSiteFilter(site)}
                >
                  {site === 'all' ? 'Tous les sites' : site === 'conches' ? 'Conches' : 'Beaumont'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {(['all', 'livraison', 'emporter'] as OrderTypeFilter[]).map((type) => (
                <Button
                  key={type}
                  variant={orderTypeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setOrderTypeFilter(type)}
                >
                  {type === 'all'
                    ? 'Tous les types'
                    : type === 'livraison'
                    ? 'Livraison'
                    : 'À emporter'}
                  {type === 'livraison' && <Truck className="h-3 w-3 ml-1.5" />}
                  {type === 'emporter' && <Store className="h-3 w-3 ml-1.5" />}
                </Button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredWeeks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>
                {weeks.length === 0
                  ? 'Aucune semaine archivée pour le moment.'
                  : 'Aucune commande ne correspond à ce filtre.'}
              </p>
              <p className="text-sm mt-1">
                {weeks.length === 0
                  ? 'Les commandes seront archivées automatiquement chaque lundi à 3h00.'
                  : 'Essayez un autre site ou vérifiez plus tard.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {filteredWeeks.map((week) => (
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
                      Aucune commande cette semaine pour ce site.
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
