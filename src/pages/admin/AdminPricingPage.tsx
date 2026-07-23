import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { usePricing } from '@/contexts/PricingContext';
import { supabase } from '@/integrations/supabase/client';
import { DAY_NAMES, MANAGED_ITEMS } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SIZES: { id: string; name: string }[] = [
  { id: 'senior', name: 'Senior' },
  { id: 'mega', name: 'Méga' },
  { id: 'super-mega', name: 'Super Méga' },
];

export default function AdminPricingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: adminLoading } = useAdmin();
  const { sizePrices, dayPromos, itemPrices, refresh } = usePricing();

  const [sizeDraft, setSizeDraft] = useState<Record<string, string>>({});
  const [savingSizes, setSavingSizes] = useState(false);

  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});
  const [savingItems, setSavingItems] = useState(false);

  // Nouvelle promo
  const [newDay, setNewDay] = useState<string>('2');
  const [newSize, setNewSize] = useState<string>('senior');
  const [newPrice, setNewPrice] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const [newRecurrence, setNewRecurrence] = useState<'weekly' | 'monthly'>('weekly');
  const [newWeekOfMonth, setNewWeekOfMonth] = useState<string>('1');
  const [addingPromo, setAddingPromo] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isSuperAdmin) navigate('/admin');
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  useEffect(() => {
    setSizeDraft({
      senior: String(sizePrices.senior ?? ''),
      mega: String(sizePrices.mega ?? ''),
      'super-mega': String(sizePrices['super-mega'] ?? ''),
    });
  }, [sizePrices]);

  useEffect(() => {
    const draft: Record<string, string> = {};
    MANAGED_ITEMS.forEach((it) => {
      draft[it.key] = String(itemPrices[it.key] ?? '');
    });
    setItemDraft(draft);
  }, [itemPrices]);

  const saveItems = async () => {
    setSavingItems(true);
    const rows = MANAGED_ITEMS.map((it) => ({
      item_key: it.key,
      price: parseFloat(itemDraft[it.key]),
    })).filter((r) => !isNaN(r.price));

    const { error } = await supabase
      .from('menu_item_prices')
      .upsert(rows, { onConflict: 'item_key' });

    setSavingItems(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tarifs enregistrés', description: 'Le menu est mis à jour en temps réel.' });
      await refresh();
    }
  };

  const saveSizes = async () => {
    setSavingSizes(true);
    const rows = SIZES.map((s) => ({
      size_id: s.id,
      price: parseFloat(sizeDraft[s.id]),
    })).filter((r) => !isNaN(r.price));

    const { error } = await supabase
      .from('pizza_size_prices')
      .upsert(rows, { onConflict: 'size_id' });

    setSavingSizes(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tarifs enregistrés', description: 'Le menu est mis à jour en temps réel.' });
      await refresh();
    }
  };

  const addPromo = async () => {
    const price = parseFloat(newPrice);
    if (isNaN(price)) {
      toast({ title: 'Prix invalide', variant: 'destructive' });
      return;
    }
    setAddingPromo(true);
    const { error } = await supabase.from('pizza_day_promos').insert({
      day_of_week: parseInt(newDay, 10),
      size_id: newSize,
      price,
      label: newLabel || null,
      is_active: true,
      recurrence: newRecurrence,
      week_of_month: newRecurrence === 'monthly' ? parseInt(newWeekOfMonth, 10) : null,
    } as any);
    setAddingPromo(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setNewPrice('');
      setNewLabel('');
      toast({ title: 'Promotion ajoutée' });
      await refresh();
    }
  };

  const WEEK_OF_MONTH_LABEL: Record<number, string> = {
    1: '1re semaine',
    2: '2e semaine',
    3: '3e semaine',
    4: '4e semaine',
    [-1]: 'dernière semaine',
  };

  const describeRecurrence = (p: { recurrence?: string; week_of_month?: number | null; day_of_week: number }) => {
    if (p.recurrence === 'monthly' && p.week_of_month != null) {
      return `${WEEK_OF_MONTH_LABEL[p.week_of_month] ?? p.week_of_month} du mois`;
    }
    return 'Toutes les semaines';
  };

  const togglePromo = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('pizza_day_promos').update({ is_active }).eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await refresh();
  };

  const deletePromo = async (id: string) => {
    const { error } = await supabase.from('pizza_day_promos').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Promotion supprimée' });
      await refresh();
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  const sizeName = (id: string) => SIZES.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Gestion des tarifs</h1>
            <p className="text-sm text-muted-foreground">Prix des pizzas & promotions</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Prix par taille */}
        <Card>
          <CardHeader>
            <CardTitle>Prix par taille de pizza</CardTitle>
            <CardDescription>
              Modification en masse : ces prix s'appliquent à toutes les pizzas (les deux sites).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {SIZES.map((s) => (
                <div key={s.id} className="space-y-2">
                  <Label htmlFor={`size-${s.id}`}>{s.name}</Label>
                  <div className="relative">
                    <Input
                      id={`size-${s.id}`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={sizeDraft[s.id] ?? ''}
                      onChange={(e) =>
                        setSizeDraft((d) => ({ ...d, [s.id]: e.target.value }))
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={saveSizes} disabled={savingSizes}>
              <Save className="h-4 w-4 mr-2" />
              {savingSizes ? 'Enregistrement...' : 'Enregistrer les tarifs'}
            </Button>
          </CardContent>
        </Card>

        {/* Autres éléments du menu */}
        <Card>
          <CardHeader>
            <CardTitle>Autres éléments du menu</CardTitle>
            <CardDescription>
              Tarifs des boissons, paninis et du menu Bambino (communs aux deux sites).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {MANAGED_ITEMS.map((it) => (
                <div key={it.key} className="space-y-2">
                  <Label htmlFor={`item-${it.key}`}>{it.name}</Label>
                  <div className="relative">
                    <Input
                      id={`item-${it.key}`}
                      type="number"
                      step="0.5"
                      min="0"
                      value={itemDraft[it.key] ?? ''}
                      onChange={(e) =>
                        setItemDraft((d) => ({ ...d, [it.key]: e.target.value }))
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={saveItems} disabled={savingItems}>
              <Save className="h-4 w-4 mr-2" />
              {savingItems ? 'Enregistrement...' : 'Enregistrer les tarifs'}
            </Button>
          </CardContent>
        </Card>



        {/* Promotions par jour */}
        <Card>
          <CardHeader>
            <CardTitle>Promotions par jour de la semaine</CardTitle>
            <CardDescription>
              Définissez un prix promotionnel pour une taille un jour précis. Prioritaire sur le tarif normal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
              <div className="space-y-2">
                <Label>Jour</Label>
                <Select value={newDay} onValueChange={setNewDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Taille</Label>
                <Select value={newSize} onValueChange={setNewSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prix (€)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Libellé (option.)</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ex: Lundi Méga 15€"
                />
              </div>
              <Button onClick={addPromo} disabled={addingPromo}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 items-end">
              <div className="space-y-2">
                <Label>Récurrence</Label>
                <Select value={newRecurrence} onValueChange={(v) => setNewRecurrence(v as 'weekly' | 'monthly')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Tous les {DAY_NAMES[parseInt(newDay, 10)]?.toLowerCase()}</SelectItem>
                    <SelectItem value="monthly">Un {DAY_NAMES[parseInt(newDay, 10)]?.toLowerCase()} précis du mois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newRecurrence === 'monthly' && (
                <div className="space-y-2">
                  <Label>Semaine du mois</Label>
                  <Select value={newWeekOfMonth} onValueChange={setNewWeekOfMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1re semaine (1er {DAY_NAMES[parseInt(newDay, 10)]?.toLowerCase()})</SelectItem>
                      <SelectItem value="2">2e semaine</SelectItem>
                      <SelectItem value="3">3e semaine</SelectItem>
                      <SelectItem value="4">4e semaine</SelectItem>
                      <SelectItem value="-1">Dernier {DAY_NAMES[parseInt(newDay, 10)]?.toLowerCase()} du mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {dayPromos.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune promotion configurée.</p>
              )}
              {dayPromos
                .slice()
                .sort((a, b) => a.day_of_week - b.day_of_week)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {DAY_NAMES[p.day_of_week]} · {sizeName(p.size_id)} · {p.price}€
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {describeRecurrence(p)}
                      </p>
                      {p.label && (
                        <p className="text-sm text-muted-foreground truncate">{p.label}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => togglePromo(p.id, v)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deletePromo(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
