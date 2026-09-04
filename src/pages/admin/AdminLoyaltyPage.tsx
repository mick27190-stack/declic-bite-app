import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Gift, Loader2, Save, Search, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  CATEGORY_LABELS,
  LOYALTY_SITES,
  SITE_LABELS,
  buildLoyaltyCsv,
  downloadBlob,
  isProgramActive,
  rewardLabel,
  type LoyaltyCategory,
  type LoyaltyOverviewRow,
  type LoyaltyProgram,
} from '@/lib/loyalty';

interface OverviewCustomer {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  rows: {
    program: LoyaltyProgram;
    currentCount: number;
    pendingIds: string[];
  }[];
}

export default function AdminLoyaltyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: adminLoading } = useAdmin();

  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LoyaltyProgram>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState<OverviewCustomer[]>([]);
  const [suiviCustomers, setSuiviCustomers] = useState<OverviewCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [suiviSearch, setSuiviSearch] = useState('');
  const [suiviSiteFilter, setSuiviSiteFilter] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isSuperAdmin) navigate('/admin');
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  const loadPrograms = useCallback(async () => {
    const { data } = await supabase
      .from('loyalty_programs')
      .select('*')
      .order('site')
      .order('category');
    const list = (data ?? []) as unknown as LoyaltyProgram[];
    setPrograms(list);
    setDrafts(Object.fromEntries(list.map((p) => [p.id, { ...p }])));
    return list;
  }, []);

  const loadOverview = useCallback(async (list: LoyaltyProgram[]) => {
    const [{ data: progress }, { data: rewards }] = await Promise.all([
      supabase.from('customer_loyalty_progress').select('*'),
      supabase.from('loyalty_rewards_pending').select('*').eq('status', 'pending'),
    ]);

    const progressList = (progress ?? []) as any[];
    const rewardList = (rewards ?? []) as any[];

    const ids = Array.from(
      new Set([...progressList.map((p) => p.customer_id), ...rewardList.map((r) => r.customer_id)]),
    );
    if (ids.length === 0) {
      setCustomers([]);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, phone, email')
      .in('user_id', ids);
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const full: OverviewCustomer[] = ids.map((customerId) => {
      const profile: any = profileMap.get(customerId);
      const rows = list.map((program) => ({
        program,
        currentCount:
          progressList.find((p) => p.customer_id === customerId && p.program_id === program.id)
            ?.current_count ?? 0,
        pendingIds: rewardList
          .filter((r) => r.customer_id === customerId && r.program_id === program.id)
          .map((r) => r.id as string),
      }));

      return {
        customerId,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—',
        phone: profile?.phone ?? '',
        email: profile?.email ?? '',
        rows,
      };
    });

    full.sort((a, b) => a.name.localeCompare(b.name));
    setSuiviCustomers(full);
    setCustomers(
      full
        .map((c) => ({
          ...c,
          rows: c.rows.filter((r) => r.currentCount > 0 || r.pendingIds.length > 0),
        }))
        .filter((c) => c.rows.length > 0),
    );
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await loadPrograms();
      await loadOverview(list);
    } finally {
      setLoading(false);
    }
  }, [loadPrograms, loadOverview]);

  useEffect(() => {
    if (isSuperAdmin) refresh();
  }, [isSuperAdmin, refresh]);

  const handleSave = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    if (draft.reward_type === 'discount_amount' && !(Number(draft.discount_amount) > 0)) {
      toast({
        title: 'Montant requis',
        description: 'Renseignez un montant de remise supérieur à 0€.',
        variant: 'destructive',
      });
      return;
    }
    if (draft.start_date && draft.end_date && draft.end_date < draft.start_date) {
      toast({
        title: 'Dates invalides',
        description: 'La date de fin doit être postérieure à la date de début.',
        variant: 'destructive',
      });
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from('loyalty_programs')
      .update({
        enabled: draft.enabled,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        required_count: Number(draft.required_count) || 1,
        reward_type: draft.reward_type,
        discount_amount:
          draft.reward_type === 'discount_amount' ? Number(draft.discount_amount) : null,
      } as any)
      .eq('id', id);
    setSavingId(null);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Programme enregistré' });
    refresh();
  };

  const cancelReward = async (rewardId: string) => {
    const { error } = await supabase
      .from('loyalty_rewards_pending')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() } as any)
      .eq('id', rewardId);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Récompense annulée' });
    refresh();
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .map((c) => ({
        ...c,
        rows: c.rows.filter((r) => siteFilter === 'all' || r.program.site === siteFilter),
      }))
      .filter((c) => c.rows.length > 0)
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      );
  }, [customers, search, siteFilter]);

  const filteredSuivi = useMemo(() => {
    const q = suiviSearch.trim().toLowerCase();
    return suiviCustomers
      .map((c) => ({
        ...c,
        rows: c.rows.filter((r) => suiviSiteFilter === 'all' || r.program.site === suiviSiteFilter),
      }))
      .filter((c) => c.rows.length > 0)
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      );
  }, [suiviCustomers, suiviSearch, suiviSiteFilter]);


  const exportRows: LoyaltyOverviewRow[] = useMemo(
    () =>
      filteredCustomers.flatMap((c) =>
        c.rows.map((r) => ({
          customerName: c.name,
          phone: c.phone,
          email: c.email,
          site: r.program.site,
          category: r.program.category as LoyaltyCategory,
          currentCount: r.currentCount,
          requiredCount: r.program.required_count,
          pendingRewards: r.pendingIds.length,
        })),
      ),
    [filteredCustomers],
  );

  const stamp = () => new Date().toISOString().slice(0, 10);

  const handleExportCsv = () => {
    downloadBlob(buildLoyaltyCsv(exportRows), `fidelite-${stamp()}.csv`);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('Carte de fidélité — vue d’ensemble', 14, 16);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 23);

    const headers = ['Client', 'Téléphone', 'Site', 'Catégorie', 'Progression', 'En attente'];
    const cols = [14, 70, 120, 150, 195, 235];
    let y = 34;
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => doc.text(h, cols[i], y));
    doc.setFont('helvetica', 'normal');
    y += 6;

    exportRows.forEach((r) => {
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
      const values = [
        r.customerName.slice(0, 28),
        r.phone,
        SITE_LABELS[r.site] ?? r.site,
        CATEGORY_LABELS[r.category],
        `${r.currentCount}/${r.requiredCount}`,
        String(r.pendingRewards),
      ];
      values.forEach((v, i) => doc.text(v, cols[i], y));
      y += 6;
    });

    doc.save(`fidelite-${stamp()}.pdf`);
  };

  if (authLoading || adminLoading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-primary">Carte de fidélité</h1>
              <p className="text-sm text-muted-foreground">Programmes et progression clients</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="settings">
          <TabsList className="mb-6">
            <TabsTrigger value="settings">Paramétrage</TabsTrigger>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="suivi">Suivi</TabsTrigger>
          </TabsList>

          {/* ---------------- Paramétrage ---------------- */}
          <TabsContent value="settings">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              LOYALTY_SITES.map((site) => (
                <section key={site} className="mb-8">
                  <h2 className="text-lg font-semibold mb-3">{SITE_LABELS[site] ?? site}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {programs
                      .filter((p) => p.site === site)
                      .map((program) => {
                        const draft = drafts[program.id] ?? program;
                        const active = isProgramActive(draft);
                        const update = (patch: Partial<LoyaltyProgram>) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [program.id]: { ...(prev[program.id] ?? program), ...patch },
                          }));
                        return (
                          <Card key={program.id}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-base">
                                  Pizzas {CATEGORY_LABELS[program.category]}
                                </CardTitle>
                                <Switch
                                  checked={draft.enabled}
                                  onCheckedChange={(v) => update({ enabled: v })}
                                />
                              </div>
                              <CardDescription>
                                {active ? (
                                  <Badge className="bg-green-600 hover:bg-green-600">
                                    Actif aujourd'hui
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Inactif</Badge>
                                )}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Début</Label>
                                  <Input
                                    type="date"
                                    value={draft.start_date ?? ''}
                                    onChange={(e) => update({ start_date: e.target.value || null })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Fin</Label>
                                  <Input
                                    type="date"
                                    value={draft.end_date ?? ''}
                                    onChange={(e) => update({ end_date: e.target.value || null })}
                                  />
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs">Nombre de pizzas à acheter</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={draft.required_count}
                                  onChange={(e) =>
                                    update({ required_count: Number(e.target.value) })
                                  }
                                />
                              </div>

                              <div>
                                <Label className="text-xs">Récompense</Label>
                                <Select
                                  value={draft.reward_type}
                                  onValueChange={(v) =>
                                    update({ reward_type: v as LoyaltyProgram['reward_type'] })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free_pizza">Pizza offerte</SelectItem>
                                    <SelectItem value="discount_amount">Remise en €</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {draft.reward_type === 'discount_amount' && (
                                <div>
                                  <Label className="text-xs">Montant de la remise (€)</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.5"
                                    value={draft.discount_amount ?? ''}
                                    onChange={(e) =>
                                      update({ discount_amount: Number(e.target.value) })
                                    }
                                  />
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">{rewardLabel(draft)}</p>

                              <Button
                                className="w-full"
                                size="sm"
                                onClick={() => handleSave(program.id)}
                                disabled={savingId === program.id}
                              >
                                {savingId === program.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 mr-2" />
                                )}
                                Enregistrer
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </section>
              ))
            )}
          </TabsContent>

          {/* ---------------- Vue d'ensemble ---------------- */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progression des clients</CardTitle>
                <CardDescription>
                  Compteurs par programme et récompenses en attente
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher un client…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les sites</SelectItem>
                      {LOYALTY_SITES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SITE_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={exportFormat}
                    onValueChange={(v) => setExportFormat(v as 'csv' | 'pdf')}
                  >
                    <SelectTrigger className="sm:w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={exportFormat === 'csv' ? handleExportCsv : handleExportPdf}
                    disabled={exportRows.length === 0}
                  >
                    {exportFormat === 'csv' ? (
                      <Download className="h-4 w-4 mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Exporter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Aucune progression enregistrée pour le moment.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="min-w-[160px]">Progression</TableHead>
                          <TableHead>Récompenses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.flatMap((c) =>
                          c.rows.map((r) => (
                            <TableRow key={`${c.customerId}-${r.program.id}`}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell>{c.phone || '—'}</TableCell>
                              <TableCell>
                                {SITE_LABELS[r.program.site] ?? r.program.site}
                              </TableCell>
                              <TableCell>{CATEGORY_LABELS[r.program.category]}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    className="h-2 w-24 bg-muted"
                                    value={Math.min(
                                      100,
                                      (r.currentCount / r.program.required_count) * 100,
                                    )}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {r.currentCount}/{r.program.required_count}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {r.pendingIds.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-green-600 hover:bg-green-600">
                                      {r.pendingIds.length} en attente
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cancelReward(r.pendingIds[0])}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Annuler
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )),
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- Suivi ---------------- */}
          <TabsContent value="suivi">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suivi des clients</CardTitle>
                <CardDescription>
                  Chaque client avec ses programmes, sa progression et ses récompenses en attente
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Rechercher un client…"
                      value={suiviSearch}
                      onChange={(e) => setSuiviSearch(e.target.value)}
                    />
                  </div>
                  <Select value={suiviSiteFilter} onValueChange={setSuiviSiteFilter}>
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les sites</SelectItem>
                      {LOYALTY_SITES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SITE_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredSuivi.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Aucun client à suivre pour le moment.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredSuivi.map((c) => (
                      <div key={c.customerId} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[c.phone, c.email].filter(Boolean).join(' • ') || '—'}
                            </p>
                          </div>
                          {c.rows.some((r) => r.pendingIds.length > 0) && (
                            <Badge className="bg-green-600 hover:bg-green-600">
                              {c.rows.reduce((n, r) => n + r.pendingIds.length, 0)} récompense(s) en attente
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {c.rows.map((r) => (
                            <div key={r.program.id} className="rounded-md bg-muted/40 p-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-sm font-medium">
                                  {CATEGORY_LABELS[r.program.category]} —{' '}
                                  {SITE_LABELS[r.program.site] ?? r.program.site}
                                </span>
                                {isProgramActive(r.program) ? (
                                  <Badge variant="secondary" className="text-[10px]">Actif</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Inactif</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  className="h-2 flex-1 bg-muted"
                                  value={Math.min(
                                    100,
                                    (r.currentCount / r.program.required_count) * 100,
                                  )}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {r.currentCount}/{r.program.required_count}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {rewardLabel(r.program)}
                              </p>
                              {r.pendingIds.length > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-green-600 hover:bg-green-600">
                                    {r.pendingIds.length} en attente
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelReward(r.pendingIds[0])}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Annuler
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
