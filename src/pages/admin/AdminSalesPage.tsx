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
}

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

  const totals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({ pizzas: acc.pizzas + d.pizzas, revenue: acc.revenue + d.revenue }),
      { pizzas: 0, revenue: 0 }
    );
  }, [dailyStats]);

  const chartData = useMemo(() => {
    return dailyStats.map(d => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      revenue: Math.round(d.revenue * 100) / 100,
    }));
  }, [dailyStats]);

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

  // Group daily stats by month for monthly exports
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, { month: string; days: typeof dailyStats; pizzas: number; revenue: number }>();
    dailyStats.forEach(d => {
      const monthKey = d.date.slice(0, 7); // YYYY-MM
      const entry = map.get(monthKey) || { month: monthKey, days: [], pizzas: 0, revenue: 0 };
      entry.days.push(d);
      entry.pizzas += d.pizzas;
      entry.revenue += d.revenue;
      map.set(monthKey, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [dailyStats]);

  const monthLabel = (key: string) =>
    new Date(key + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
    const lines: string[] = ['Date;Pizzas;Chiffre d\'affaires (€)'];
    monthlyGroups.forEach(m => {
      lines.push('');
      lines.push(`${monthLabel(m.month).toUpperCase()}`);
      [...m.days].reverse().forEach(d => {
        const label = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        lines.push(`${label};${d.pizzas};${d.revenue.toFixed(2)}`);
      });
      lines.push(`TOTAL ${monthLabel(m.month).toUpperCase()};${m.pizzas};${m.revenue.toFixed(2)}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `ventes-mensuelles-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Suivi des ventes — Détail mensuel', 14, 18);
    let startY = 26;
    monthlyGroups.forEach(m => {
      const body = [...m.days].reverse().map(d => [
        new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
        String(d.pizzas),
        `${d.revenue.toFixed(2)} €`,
      ]);
      body.push([`TOTAL ${monthLabel(m.month)}`, String(m.pizzas), `${m.revenue.toFixed(2)} €`]);
      autoTable(doc, {
        head: [[monthLabel(m.month).toUpperCase(), 'Pizzas', 'CA']],
        body,
        startY,
        theme: 'striped',
        headStyles: { fillColor: [234, 88, 12] },
        didParseCell: (data) => {
          if (data.row.index === body.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 237, 213];
          }
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
    });
    downloadBlob(doc.output('blob'), `ventes-mensuelles-${new Date().toISOString().slice(0, 10)}.pdf`);
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

    // Group export daily stats by month
    const monthMap = new Map<string, { month: string; days: typeof exportDailyStats; pizzas: number; revenue: number }>();
    exportDailyStats.forEach(d => {
      const monthKey = d.date.slice(0, 7);
      const entry = monthMap.get(monthKey) || { month: monthKey, days: [], pizzas: 0, revenue: 0 };
      entry.days.push(d);
      entry.pizzas += d.pizzas;
      entry.revenue += d.revenue;
      monthMap.set(monthKey, entry);
    });
    const exportMonthlyGroups = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));

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
        ['Chiffre d\'affaires total', `${exportTotalRevenue.toFixed(2)} €`],
        ['Pizzas vendues', String(exportTotalPizzas)],
        ['Commandes', String(exportOrders.length)],
        ['Panier moyen', `${exportOrders.length ? (exportTotalRevenue / exportOrders.length).toFixed(2) : '0.00'} €`],
      ],
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
    });
    let startY = (doc as any).lastAutoTable.finalY + 8;

    // 2. Totaux par site
    autoTable(doc, {
      head: [['Site', 'Commandes', 'Pizzas', 'CA']],
      body: exportSiteTotals.map(s => [s.site, String(s.orders), String(s.pizzas), `${s.revenue.toFixed(2)} €`]),
      startY,
      theme: 'striped',
      headStyles: { fillColor: [234, 88, 12] },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;

    // 3. Détail mensuel
    doc.setFontSize(13);
    doc.text('Détail par mois', 14, startY);
    startY += 6;
    exportMonthlyGroups.forEach(m => {
      const body = [...m.days].reverse().map(d => [
        new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
        String(d.pizzas),
        `${d.revenue.toFixed(2)} €`,
      ]);
      body.push([`TOTAL ${monthLabel(m.month)}`, String(m.pizzas), `${m.revenue.toFixed(2)} €`]);
      autoTable(doc, {
        head: [[monthLabel(m.month).toUpperCase(), 'Pizzas', 'CA']],
        body,
        startY,
        theme: 'striped',
        headStyles: { fillColor: [234, 88, 12] },
        didParseCell: (data) => {
          if (data.row.index === body.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 237, 213];
          }
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 10;
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
            <span className="text-xs text-muted-foreground">Du</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-[150px] justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy', { locale: fr }) : <span>Date début</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && setStartDate(d)}
                  disabled={(d) => d > endDate || d > new Date()}
                  initialFocus
                  locale={fr}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Au</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-[150px] justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy', { locale: fr }) : <span>Date fin</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && setEndDate(d)}
                  disabled={(d) => d < startDate || d > new Date()}
                  initialFocus
                  locale={fr}
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
              Chiffre d'affaires par jour
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
              Pizzas vendues par jour
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
                Détail par jour
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
                    <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Pizzas</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">CA</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailyStats].reverse().map(d => (
                    <tr key={d.date} className="border-b border-border/50">
                      <td className="py-2">
                        {new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="text-right py-2 font-medium">{d.pizzas}</td>
                      <td className="text-right py-2 font-medium text-primary">{d.revenue.toFixed(2)}€</td>
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
