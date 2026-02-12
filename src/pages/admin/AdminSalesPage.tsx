import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, TrendingUp, Pizza, Euro, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import NotificationBell from '@/components/admin/NotificationBell';

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
  const [period, setPeriod] = useState<'7' | '14' | '30'>('7');
  const [filterSite, setFilterSite] = useState<'all' | 'conches' | 'beaumont'>('all');

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
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      const { data, error } = await supabase
        .from('orders')
        .select('created_at, total_price, items, restaurant, status')
        .gte('created_at', since.toISOString())
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (!error && data) setOrders(data);
      setLoading(false);
    };

    fetchOrders();
  }, [user, isAnyAdmin, period]);

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

    // Pre-fill all days in the period
    const days = parseInt(period);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, pizzas: 0, revenue: 0 });
    }

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
  }, [filteredOrders, period]);

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
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="14">14 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
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

        {/* Daily Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Détail par jour
            </CardTitle>
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
