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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ArrowLeft, RefreshCw, History, Package, MapPin, Truck, Store, FileDown, Calendar, Printer, Trash2, Phone, ChevronDown, Search, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { statusLabels, statusColors, OrderStatus } from '@/types/order';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import OrderTicket, { OrderTicketData } from '@/components/OrderTicket';
import { useCompanyInfo, resolveCompanyForRestaurant } from '@/hooks/useCompanyInfo';

interface HistoryOrder {
  id: string;
  restaurant: string;
  order_type: 'emporter' | 'livraison';
  status: OrderStatus;
  total_price: number;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  items?: any[];
  delivery_address?: any;
  pickup_time?: string | null;
  delivery_estimate?: string | null;
  notes?: string | null;
  user_id?: string | null;
}

interface HistoryWeek {
  id: string;
  week_start: string;
  week_end: string;
  order_count: number;
  total_revenue: number;
  orders: HistoryOrder[];
  /** One entry per archived site row backing this week (site-scoped rows). */
  parts?: { id: string; site: string }[];
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
type PeriodFilter = 'all' | '4weeks' | '8weeks' | '12weeks' | 'custom';

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

function periodLabel(period: PeriodFilter) {
  switch (period) {
    case 'all':
      return "Tout l'historique";
    case '4weeks':
      return '4 dernières semaines';
    case '8weeks':
      return '8 dernières semaines';
    case '12weeks':
      return '12 dernières semaines';
    case 'custom':
      return 'Personnalisé';
  }
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function filterWeeksByPeriod(
  weeks: HistoryWeek[],
  period: PeriodFilter,
  customStart: string | null,
  customEnd: string | null
): HistoryWeek[] {
  if (period === 'all') return weeks;
  if (period === 'custom') {
    if (!customStart && !customEnd) return weeks;
    const start = customStart ? new Date(customStart) : null;
    const end = customEnd ? new Date(customEnd) : null;
    return weeks.filter((w) => {
      const weekStart = new Date(w.week_start);
      const weekEnd = new Date(w.week_end);
      if (start && weekEnd < start) return false;
      if (end && weekStart > end) return false;
      return true;
    });
  }
  const count = period === '4weeks' ? 4 : period === '8weeks' ? 8 : 12;
  return weeks.slice(0, count);
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
  orderTypeFilter: OrderTypeFilter,
  periodFilter: PeriodFilter,
  customStart: string | null,
  customEnd: string | null
) {
  let periodText = periodLabel(periodFilter);
  if (periodFilter === 'custom' && (customStart || customEnd)) {
    periodText += ` (${customStart || '...'} au ${customEnd || '...'})`;
  }
  const filterLine = `Filtres;${siteLabel(siteFilter)};${orderTypeLabel(orderTypeFilter)};${periodText}\n`;
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
  orderTypeFilter: OrderTypeFilter,
  periodFilter: PeriodFilter,
  customStart: string | null,
  customEnd: string | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let periodText = periodLabel(periodFilter);
  if (periodFilter === 'custom' && (customStart || customEnd)) {
    periodText += ` (${customStart || '...'} au ${customEnd || '...'})`;
  }

  doc.setFontSize(18);
  doc.text('Historique des commandes', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(
    `Filtres : ${siteLabel(siteFilter)} · ${orderTypeLabel(orderTypeFilter)} · ${periodText}`,
    14,
    28
  );

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
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderToPrint, setOrderToPrint] = useState<OrderTicketData | null>(null);
  const { data: companyData } = useCompanyInfo();

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

  const handlePrint = async (o: HistoryOrder) => {
    // Fetch full order from DB (items, address, notes...) if still present.
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', o.id)
      .maybeSingle();

    setOrderToPrint({
      id: o.id,
      created_at: o.created_at,
      restaurant: o.restaurant,
      order_type: o.order_type,
      status: o.status,
      total_price: Number(o.total_price),
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      items: (data as any)?.items ?? o.items,
      delivery_address: (data as any)?.delivery_address ?? o.delivery_address,
      pickup_time: (data as any)?.pickup_time ?? o.pickup_time,
      delivery_estimate: (data as any)?.delivery_estimate ?? o.delivery_estimate,
      notes: (data as any)?.notes ?? o.notes,
    });
  };

  const handleDeleteOrder = async (week: HistoryWeek, orderId: string) => {
    const target = (week.orders || []).find((o) => o.id === orderId);
    const site = target ? orderSite(target.restaurant) : null;
    const parts = week.parts && week.parts.length > 0
      ? week.parts
      : [{ id: week.id, site: site || 'conches' }];
    const part = parts.find((p) => p.site === site) || parts[0];

    // Only rewrite the site row that actually holds this order.
    const remaining = (week.orders || []).filter(
      (o) => o.id !== orderId && orderSite(o.restaurant) === part.site
    );
    const total = remaining.reduce(
      (sum, o) => sum + (o.status === 'cancelled' ? 0 : Number(o.total_price) || 0),
      0
    );
    const { error } = await supabase
      .from('order_history')
      .update({
        orders: remaining as any,
        order_count: remaining.length,
        total_revenue: total,
      })
      .eq('id', part.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Commande supprimée de l\'historique' });
      fetchHistory();
    }
  };

  const handleDeleteWeek = async (weekId: string) => {
    const week = weeks.find((w) => w.id === weekId);
    const ids = week?.parts?.length ? week.parts.map((p) => p.id) : [weekId];
    const { error } = await supabase.from('order_history').delete().in('id', ids);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Semaine supprimée de l\'historique' });
      fetchHistory();
    }
  };



  const normalizedSearch = customerSearch
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const filteredWeeks = filterWeeksByPeriod(
    weeks
      .map((week) => {
        const filteredOrders = week.orders.filter((o) => {
          const siteMatch = siteFilter === 'all' || orderSite(o.restaurant) === siteFilter;
          const typeMatch = orderTypeFilter === 'all' || o.order_type === orderTypeFilter;
          let searchMatch = true;
          if (normalizedSearch) {
            const haystack = [o.customer_name, o.customer_phone]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            searchMatch = haystack.includes(normalizedSearch);
          }
          return siteMatch && typeMatch && searchMatch;
        });
        return {
          ...week,
          orders: filteredOrders,
          order_count: filteredOrders.length,
          total_revenue: filteredOrders.reduce(
            (sum, o) => sum + (o.status === 'cancelled' ? 0 : (o.total_price || 0)),
            0
          ),
        };
      })
      .filter(
        (week) =>
          week.order_count > 0 ||
          (siteFilter === 'all' && orderTypeFilter === 'all' && !normalizedSearch)
      ),
    periodFilter,
    customStart,
    customEnd
  );

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
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as (HistoryWeek & { site?: string })[];

    // History is now archived per site (one row per week and per site).
    // Merge the rows of a same week so the UI keeps showing one card per week.
    const byWeek = new Map<string, HistoryWeek>();
    rows.forEach((row) => {
      const existing = byWeek.get(row.week_start);
      const part = { id: row.id, site: row.site || 'conches' };
      if (existing) {
        existing.orders = [...(existing.orders || []), ...(row.orders || [])];
        existing.order_count += row.order_count || 0;
        existing.total_revenue = Number(existing.total_revenue) + Number(row.total_revenue || 0);
        existing.parts = [...(existing.parts || []), part];
      } else {
        byWeek.set(row.week_start, {
          ...row,
          orders: [...(row.orders || [])],
          parts: [part],
        });
      }
    });

    const rawWeeks = Array.from(byWeek.values()).sort((a, b) =>
      b.week_start.localeCompare(a.week_start)
    );

    // Archived orders JSON has no customer name/phone (not columns on `orders`).
    // Enrich from profiles via user_id so the detail view can display them.
    const userIds = Array.from(
      new Set(
        rawWeeks.flatMap((w) =>
          (w.orders || []).map((o) => o.user_id).filter((v): v is string => !!v)
        )
      )
    );

    let profileMap = new Map<string, { name: string; phone: string }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        profileMap.set(p.user_id, { name, phone: p.phone || '' });
      });
    }

    const enriched = rawWeeks.map((w) => ({
      ...w,
      orders: (w.orders || [])
        .map((o) => {
          const p = o.user_id ? profileMap.get(o.user_id) : undefined;
          return {
            ...o,
            customer_name: o.customer_name || p?.name || undefined,
            customer_phone: o.customer_phone || p?.phone || undefined,
          };
        })
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    }));

    setWeeks(enriched);

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={loading || weeks.length === 0}>
                  <FileDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    exportToCsv(filteredWeeks, siteFilter, orderTypeFilter, periodFilter, customStart, customEnd)
                  }
                >
                  Exporter en CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    exportToPdf(filteredWeeks, siteFilter, orderTypeFilter, periodFilter, customStart, customEnd)
                  }
                >
                  Exporter en PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select
                value={periodFilter}
                onValueChange={(value) => setPeriodFilter(value as PeriodFilter)}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  {(['all', '4weeks', '8weeks', '12weeks', 'custom'] as PeriodFilter[]).map(
                    (p) => (
                      <SelectItem key={p} value={p}>
                        {periodLabel(p)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {periodFilter === 'custom' && (
                <>
                  <span className="text-sm text-muted-foreground">Du</span>
                  <Input
                    type="date"
                    className="w-auto h-8 text-xs"
                    value={toDateInputValue(customStart)}
                    onChange={(e) => setCustomStart(e.target.value || null)}
                  />
                  <span className="text-sm text-muted-foreground">au</span>
                  <Input
                    type="date"
                    className="w-auto h-8 text-xs"
                    value={toDateInputValue(customEnd)}
                    onChange={(e) => setCustomEnd(e.target.value || null)}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Input
                  type="text"
                  placeholder="Rechercher un client (nom ou téléphone)"
                  className="h-8 text-xs pr-8"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
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
                  <div className="flex justify-end pb-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4 mr-1.5" /> Supprimer la semaine
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette semaine ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Toutes les commandes archivées de la semaine du {formatDate(week.week_start)} au {formatDate(week.week_end)} seront définitivement supprimées de l'historique.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteWeek(week.id)}>
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {week.orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Aucune commande cette semaine pour ce site.
                    </p>
                  ) : (
                    <div className="space-y-2 pb-2">
                      {week.orders.map((order) => (
                        <Collapsible
                          key={order.id}
                          className="rounded-md border bg-background"
                        >
                          <div className="flex items-center justify-between gap-3 p-3 text-sm">
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
                              {order.customer_phone && (
                                <a
                                  href={`tel:${order.customer_phone}`}
                                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <Phone className="h-3 w-3" /> {order.customer_phone}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={`${statusColors[order.status]} text-white`}>
                                {statusLabels[order.status]}
                              </Badge>
                              <span className="font-semibold whitespace-nowrap">
                                {Number(order.total_price).toFixed(2)} €
                              </span>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Voir le détail"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePrint(order)}
                                title="Imprimer le ticket"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Supprimer la commande"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      La commande #{order.id.slice(0, 8)}
                                      {order.customer_name ? ` de ${order.customer_name}` : ''} sera retirée de l'historique de la semaine.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteOrder(week, order.id)}>
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="border-t px-3 py-3 space-y-2 text-sm bg-muted/30">
                              {(order.pickup_time || order.delivery_estimate) && (
                                <p className="text-xs text-muted-foreground">
                                  {order.order_type === 'livraison'
                                    ? `Livraison souhaitée : ${order.pickup_time ?? '-'}${order.delivery_estimate ? ` · Estimée : ${order.delivery_estimate}` : ''}`
                                    : `Retrait : ${order.pickup_time ?? '-'}`}
                                </p>
                              )}
                              {order.delivery_address?.address && (
                                <p className="text-xs text-muted-foreground">
                                  📍 {order.delivery_address.address}
                                </p>
                              )}
                              {Array.isArray(order.items) && order.items.length > 0 ? (
                                <div className="space-y-1">
                                  {order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between gap-2">
                                      <span>
                                        {item?.quantity ?? 1}x {item?.pizza?.name ?? item?.name ?? 'Produit'}
                                        {item?.size?.name ? ` (${item.size.name})` : ''}
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
                                          <span className="block text-xs text-muted-foreground italic mt-0.5">
                                            📝 {item.notes}
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-medium whitespace-nowrap">
                                        {(
                                          (((item?.pizza?.basePrice ?? 0) +
                                            (item?.size?.price ?? 0) +
                                            (item?.supplements ?? []).reduce(
                                              (s: number, sup: any) => s + (sup.price ?? 0),
                                              0
                                            )) *
                                            (item?.quantity ?? 1)) || 0
                                        ).toFixed(2)}€
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  Détail des articles indisponible.
                                </p>
                              )}
                              {order.notes && (
                                <p className="text-xs text-muted-foreground italic border-t pt-2">
                                  📝 {order.notes}
                                </p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}

                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>

      {orderToPrint && <OrderTicket order={orderToPrint} company={resolveCompanyForRestaurant(companyData, orderToPrint.restaurant)} printOnly />}
    </div>
  );
}
