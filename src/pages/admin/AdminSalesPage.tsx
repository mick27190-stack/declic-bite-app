import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, TrendingUp, Pizza, Euro, CalendarDays, Trophy, FileDown, FileText, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import NotificationBell from '@/components/admin/NotificationBell';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderRow {
  created_at: string;
  total_price: number;
  items: any;
  restaurant: string;
  status: string;
  order_type: string;
}

// Only count an order in the revenue/stats once it has reached the relevant
// "completed" status: 'delivered' for delivery orders, 'ready' (or beyond)
// for take-away orders. Cancelled orders are never counted.
const countsForSales = (o: { status: string; order_type: string }) => {
  if (o.status === 'cancelled') return false;
  if (o.order_type === 'livraison') return o.status === 'delivered';
  // emporter: counted once prepared and beyond
  return o.status === 'ready' || o.status === 'delivered';
};

export default function AdminSalesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAnyAdmin, isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, loading: adminLoading } = useAdmin();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());
  const [filterSite, setFilterSite] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [fullExportSite, setFullExportSite] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  // Week helpers (Monday start)
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 0 = Monday
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfWeek = (d: Date) => {
    const x = startOfWeek(d);
    x.setDate(x.getDate() + 6);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  // Month helpers
  const startOfMonth = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfMonth = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  // Helpers for day-range handling (UTC keys to match order.created_at slicing)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const enumerateDayKeys = (start: Date, end: Date) => {
    const keys: string[] = [];
    const cur = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const last = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
    while (cur <= last) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  };

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isAnyAdmin) navigate('/');
    }
  }, [user, isAnyAdmin, authLoading, adminLoading, navigate]);

  useEffect(() => {
    if (!user || !isAnyAdmin) return;

    const fetchOrders = async () => {
      setLoading(true);
      const since = new Date(startDate);
      since.setHours(0, 0, 0, 0);
      const until = new Date(endDate);
      until.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_price, items, restaurant, status')
        .gte('created_at', since.toISOString())
        .lte('created_at', until.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (!error && data) setOrders(data);
      setLoading(false);
    };

    fetchOrders();
  }, [user, isAnyAdmin, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    if (filterSite === 'all' && isSuperAdmin) return orders;
    return orders.filter(o => {
      const site = o.restaurant.toLowerCase().includes('conches') ? 'conches' : 'beaumont';
      if (!isSuperAdmin) {
        if (isSiteAdminConches && site !== 'conches') return false;
        if (isSiteAdminBeaumont && site !== 'beaumont') return false;
      }
      if (filterSite !== 'all' && site !== filterSite) return false;
      return true;
    });
  }, [orders, filterSite, isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont]);

  const dailyStats = useMemo(() => {
    const map = new Map<string, { date: string; pizzas: number; revenue: number }>();

    // Pre-fill all days in the selected range
    enumerateDayKeys(startDate, endDate).forEach(key => {
      map.set(key, { date: key, pizzas: 0, revenue: 0 });
    });

    filteredOrders.forEach(order => {
      const day = order.created_at.slice(0, 10);
      const entry = map.get(day) || { date: day, pizzas: 0, revenue: 0 };

      const items = Array.isArray(order.items) ? order.items : [];
      const pizzaCount = items.reduce((sum: number, item: any) => sum + (item?.quantity ?? 1), 0);

      entry.pizzas += pizzaCount;
      entry.revenue += order.total_price;
      map.set(day, entry);
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders, startDate, endDate]);

  // Group daily stats into weeks (Monday start) for the weekly view
  const weeklyStats = useMemo(() => {
    const map = new Map<string, { date: string; pizzas: number; revenue: number }>();
    dailyStats.forEach(d => {
      const dt = new Date(d.date + 'T00:00:00');
      const day = (dt.getDay() + 6) % 7;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - day);
      const key = format(monday, 'yyyy-MM-dd');
      const entry = map.get(key) || { date: key, pizzas: 0, revenue: 0 };
      entry.pizzas += d.pizzas;
      entry.revenue += d.revenue;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyStats]);

  // Group daily stats into months for the monthly view (date = YYYY-MM-01)
  const monthlyStats = useMemo(() => {
    const map = new Map<string, { date: string; pizzas: number; revenue: number }>();
    dailyStats.forEach(d => {
      const key = d.date.slice(0, 7) + '-01';
      const entry = map.get(key) || { date: key, pizzas: 0, revenue: 0 };
      entry.pizzas += d.pizzas;
      entry.revenue += d.revenue;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyStats]);

  const displayStats = viewMode === 'month' ? monthlyStats : viewMode === 'week' ? weeklyStats : dailyStats;

  const totals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({ pizzas: acc.pizzas + d.pizzas, revenue: acc.revenue + d.revenue }),
      { pizzas: 0, revenue: 0 }
    );
  }, [dailyStats]);

  const chartData = useMemo(() => {
    return displayStats.map(d => ({
      ...d,
      label: viewMode === 'month'
        ? new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        : viewMode === 'week'
          ? `sem. ${new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`
          : new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      revenue: Math.round(d.revenue * 100) / 100,
    }));
  }, [displayStats, viewMode]);

  const topPizzas = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item: any) => {
        const name = item?.pizza?.name || item?.name || 'Inconnu';
        const qty = item?.quantity ?? 1;
        map.set(name, (map.get(name) || 0) + qty);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({ rank: i + 1, name, count }));
  }, [filteredOrders]);



  // Label for a single display row, coherent with the selected view mode
  const rowLabel = (dateKey: string) => {
    if (viewMode === 'month') {
      return new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      return `Semaine du ${new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    }
    return new Date(dateKey).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const viewNoun = viewMode === 'month' ? 'mensuel' : viewMode === 'week' ? 'hebdomadaire' : 'journalier';
  const viewColLabel = viewMode === 'month' ? 'Mois' : viewMode === 'week' ? 'Semaine' : 'Date';
  const periodWord = viewMode === 'month' ? 'par mois' : viewMode === 'week' ? 'par semaine' : 'par jour';

  // FR formatting helpers — shared by the on-screen table and the CSV/PDF exports
  // so amounts and dates match exactly.
  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  // Same value but with narrow/no-break spaces normalized so jsPDF's core font
  // renders it correctly (identical content to the on-screen amount).
  const formatEURPdf = (n: number) => formatEUR(n).replace(/[\u202f\u00a0]/g, ' ');
  const formatNumberFR = (n: number) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Inclusive period bounds in FR format (bornes incluses)
  const periodBounds = () => {
    const from = viewMode === 'month' ? startOfMonth(startDate) : startDate;
    const to = viewMode === 'month' ? endOfMonth(endDate) : endDate;
    return `du ${format(from, 'dd/MM/yyyy', { locale: fr })} au ${format(to, 'dd/MM/yyyy', { locale: fr })}`;
  };

  // Robust download that works in sandboxed preview iframes and on mobile:
  // the anchor MUST be attached to the DOM before clicking, and we fall back
  // to opening the blob in a new tab if the download attribute is blocked.
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {
        /* noop */
      }
      URL.revokeObjectURL(url);
    }, 1500);
  };

  const exportCSV = () => {
    const lines: string[] = [];
    lines.push(`Suivi des ventes ${periodWord} (${periodBounds()})`);
    lines.push('');
    lines.push(`${viewColLabel};Pizzas;Chiffre d'affaires (€)`);
    [...displayStats].reverse().forEach(d => {
      lines.push(`${rowLabel(d.date)};${d.pizzas};${formatNumberFR(d.revenue)}`);
    });
    lines.push(`TOTAL;${totals.pizzas};${formatNumberFR(totals.revenue)}`);
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `ventes-${viewNoun}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Suivi des ventes — Détail ${viewNoun}`, 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(`Période : ${periodBounds()}`, 14, 25);
    doc.setTextColor(0);
    const body = [...displayStats].reverse().map(d => [
      rowLabel(d.date),
      String(d.pizzas),
      formatEURPdf(d.revenue),
    ]);
    body.push(['TOTAL', String(totals.pizzas), formatEURPdf(totals.revenue)]);
    autoTable(doc, {
      head: [[viewColLabel, 'Pizzas', 'CA']],
      body,
      startY: 31,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12] },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 237, 213];
        }
      },
    });
    downloadBlob(doc.output('blob'), `ventes-${viewNoun}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };




  const exportFullPDF = () => {
    const doc = new jsPDF();
    const periodLabel = `${format(startDate, 'dd/MM/yyyy', { locale: fr })} au ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`;
    const generatedAt = new Date().toLocaleString('fr-FR');

    // Filter orders for the chosen site of the full export
    const exportOrders = fullExportSite === 'all'
      ? filteredOrders
      : filteredOrders.filter(o =>
          (o.restaurant.toLowerCase().includes('conches') ? 'conches' : 'beaumont') === fullExportSite
        );

    const siteFilterLabel =
      fullExportSite === 'conches' ? 'Conches' : fullExportSite === 'beaumont' ? 'Beaumont' : 'Tous les sites';

    // Recompute totals for the export subset
    const exportTotalRevenue = exportOrders.reduce((sum, o) => sum + o.total_price, 0);
    const exportTotalPizzas = exportOrders.reduce((sum, o) => {
      const items = Array.isArray(o.items) ? o.items : [];
      return sum + items.reduce((s: number, item: any) => s + (item?.quantity ?? 1), 0);
    }, 0);

    // Per-site totals for the export subset
    const siteMap = new Map<string, { site: string; pizzas: number; revenue: number; orders: number }>();
    exportOrders.forEach(order => {
      const site = order.restaurant.toLowerCase().includes('conches') ? 'Conches' : 'Beaumont';
      const entry = siteMap.get(site) || { site, pizzas: 0, revenue: 0, orders: 0 };
      const items = Array.isArray(order.items) ? order.items : [];
      entry.pizzas += items.reduce((sum: number, item: any) => sum + (item?.quantity ?? 1), 0);
      entry.revenue += order.total_price;
      entry.orders += 1;
      siteMap.set(site, entry);
    });
    const exportSiteTotals = Array.from(siteMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Daily stats for the export subset
    const dayMap = new Map<string, { date: string; pizzas: number; revenue: number }>();
    enumerateDayKeys(startDate, endDate).forEach(key => {
      dayMap.set(key, { date: key, pizzas: 0, revenue: 0 });
    });
    exportOrders.forEach(order => {
      const day = order.created_at.slice(0, 10);
      const entry = dayMap.get(day) || { date: day, pizzas: 0, revenue: 0 };
      const items = Array.isArray(order.items) ? order.items : [];
      entry.pizzas += items.reduce((sum: number, item: any) => sum + (item?.quantity ?? 1), 0);
      entry.revenue += order.total_price;
      dayMap.set(day, entry);
    });
    const exportDailyStats = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Aggregate export daily stats by the selected granularity
    const groupKey = (dateKey: string) => {
      if (viewMode === 'month') return dateKey.slice(0, 7) + '-01';
      if (viewMode === 'week') {
        const dt = new Date(dateKey + 'T00:00:00');
        const day = (dt.getDay() + 6) % 7;
        const monday = new Date(dt);
        monday.setDate(dt.getDate() - day);
        return format(monday, 'yyyy-MM-dd');
      }
      return dateKey;
    };
    const groupMap = new Map<string, { date: string; pizzas: number; revenue: number }>();
    exportDailyStats.forEach(d => {
      const key = groupKey(d.date);
      const entry = groupMap.get(key) || { date: key, pizzas: 0, revenue: 0 };
      entry.pizzas += d.pizzas;
      entry.revenue += d.revenue;
      groupMap.set(key, entry);
    });
    const exportDisplayStats = Array.from(groupMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    doc.setFontSize(18);
    doc.text('Suivi des ventes — Détail complet', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(`Site : ${siteFilterLabel}  •  Période : ${periodLabel}`, 14, 26);
    doc.text(`Généré le ${generatedAt}`, 14, 32);
    doc.setTextColor(0);

    // 1. Résumé global
    autoTable(doc, {
      head: [['Résumé global sur la période', '']],
      body: [
        ['Chiffre d\'affaires total', formatEURPdf(exportTotalRevenue)],
        ['Pizzas vendues', String(exportTotalPizzas)],
        ['Commandes', String(exportOrders.length)],
        ['Panier moyen', formatEURPdf(exportOrders.length ? exportTotalRevenue / exportOrders.length : 0)],
      ],
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
    });
    let startY = (doc as any).lastAutoTable.finalY + 8;

    // 2. Totaux par site
    autoTable(doc, {
      head: [['Site', 'Commandes', 'Pizzas', 'CA']],
      body: exportSiteTotals.map(s => [s.site, String(s.orders), String(s.pizzas), formatEURPdf(s.revenue)]),
      startY,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12] },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;

    // 3. Détail selon le type de suivi
    doc.setFontSize(13);
    doc.text(`Détail ${viewNoun}`, 14, startY);
    startY += 6;
    const detailBody = [...exportDisplayStats].reverse().map(d => [
      rowLabel(d.date),
      String(d.pizzas),
      formatEURPdf(d.revenue),
    ]);
    detailBody.push(['TOTAL', String(exportTotalPizzas), formatEURPdf(exportTotalRevenue)]);
    autoTable(doc, {
      head: [[viewColLabel, 'Pizzas', 'CA']],
      body: detailBody,
      startY,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12] },
      didParseCell: (data) => {
        if (data.row.index === detailBody.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 237, 213];
        }
      },
    });


    const siteSuffix = fullExportSite === 'all' ? 'tous-sites' : fullExportSite;
    downloadBlob(doc.output('blob'), `ventes-detail-complet-${siteSuffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
            <h1 className="text-xl font-bold text-primary">Suivi des Ventes</h1>
            <p className="text-sm text-muted-foreground">Statistiques par jour</p>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Affichage</span>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'day' | 'week' | 'month')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Par jour</SelectItem>
                <SelectItem value="week">Par semaine</SelectItem>
                <SelectItem value="month">Par mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{viewMode === 'month' ? 'Mois début' : viewMode === 'week' ? 'Semaine début' : 'Du'}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-[150px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate
                    ? (viewMode === 'month'
                        ? format(startDate, 'MMMM yyyy', { locale: fr })
                        : format(startDate, 'dd/MM/yyyy', { locale: fr }))
                    : <span>Date début</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(viewMode === 'month' ? startOfMonth(d) : viewMode === 'week' ? startOfWeek(d) : d)}
                  disabled={(d) => d > endDate || d > new Date()}
                  initialFocus
                  locale={fr}
                  weekStartsOn={1}
                  modifiers={
                    viewMode === 'month'
                      ? { selected: (d) => d >= startOfMonth(startDate) && d <= endOfMonth(startDate) }
                      : viewMode === 'week'
                        ? { selected: (d) => d >= startOfWeek(startDate) && d <= endOfWeek(startDate) }
                        : undefined
                  }
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{viewMode === 'month' ? 'Mois fin' : viewMode === 'week' ? 'Semaine fin' : 'Au'}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-[150px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate
                    ? (viewMode === 'month'
                        ? format(endDate, 'MMMM yyyy', { locale: fr })
                        : format(endDate, 'dd/MM/yyyy', { locale: fr }))
                    : <span>Date fin</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(viewMode === 'month' ? endOfMonth(d) : viewMode === 'week' ? endOfWeek(d) : d)}
                  disabled={(d) => d < startDate || d > new Date()}
                  initialFocus
                  locale={fr}
                  weekStartsOn={1}
                  modifiers={
                    viewMode === 'month'
                      ? { selected: (d) => d >= startOfMonth(endDate) && d <= endOfMonth(endDate) }
                      : viewMode === 'week'
                        ? { selected: (d) => d >= startOfWeek(endDate) && d <= endOfWeek(endDate) }
                        : undefined
                  }
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          {isSuperAdmin && (
            <Select value={filterSite} onValueChange={(v) => setFilterSite(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                <SelectItem value="conches">Conches</SelectItem>
                <SelectItem value="beaumont">Beaumont</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Pizza className="h-4 w-4 text-primary" />
                Pizzas vendues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totals.pizzas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4 text-primary" />
                Chiffre d'affaires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{totals.revenue.toFixed(0)}€</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Chiffre d'affaires {periodWord}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)}€`, 'CA']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pizzas Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pizza className="h-5 w-5 text-primary" />
              Pizzas vendues {periodWord}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: number) => [value, 'Pizzas']}
                  />
                  <Bar dataKey="pizzas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Pizzas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Top 5 des pizzas les plus vendues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPizzas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>
            ) : (
              <div className="space-y-3">
                {topPizzas.map(p => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${p.rank === 1 ? 'bg-yellow-500 text-yellow-950' : p.rank === 2 ? 'bg-gray-300 text-gray-800' : p.rank === 3 ? 'bg-amber-600 text-amber-50' : 'bg-muted text-muted-foreground'}`}>
                      {p.rank}
                    </span>
                    <span className="flex-1 font-medium text-foreground">{p.name}</span>
                    <span className="text-sm font-semibold text-primary">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Détail {periodWord}
              </CardTitle>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={exportCSV} disabled={dailyStats.length === 0}>
                  <FileDown className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={exportPDF} disabled={dailyStats.length === 0}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <Select value={fullExportSite} onValueChange={(v) => setFullExportSite(v as any)}>
                    <SelectTrigger className="h-9 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Les 2 sites</SelectItem>
                      <SelectItem value="conches">Conches</SelectItem>
                      <SelectItem value="beaumont">Beaumont</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="default" size="sm" className="flex-1 sm:flex-none" onClick={exportFullPDF} disabled={dailyStats.length === 0}>
                    <FileText className="h-4 w-4" />
                    Détail complet
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-muted-foreground font-medium">{viewColLabel}</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Pizzas</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {[...displayStats].reverse().map(d => (
                    <tr key={d.date} className="border-b border-border/50">
                      <td className="py-2">{rowLabel(d.date)}</td>
                      <td className="text-right py-2 font-medium">{d.pizzas}</td>
                      <td className="text-right py-2 font-medium text-primary">{formatEUR(d.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
