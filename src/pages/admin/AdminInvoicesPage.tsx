import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, FileDown, Loader2, Search, Send, Download, RefreshCw, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NotificationBell from '@/components/admin/NotificationBell';

interface InvoiceRow {
  id: string;
  order_id: string;
  invoice_number: string;
  storage_path: string;
  total_ttc: number;
  recipient_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  restaurant: string;
  site: string;
  sent_at: string;
  resent_count: number;
  last_resent_at: string | null;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type PeriodFilter = 'all' | 'month' | 'quarter' | 'year';

const periodLabels: Record<PeriodFilter, string> = {
  all: 'Toutes les périodes',
  month: 'Mois en cours',
  quarter: 'Trimestre en cours',
  year: 'Année en cours',
};

const siteLabel = (site: string) =>
  site === 'all' ? 'Tous les sites' : site === 'conches' ? 'Conches' : 'Beaumont';

function matchesPeriod(sentAt: string, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const d = new Date(sentAt);
  const now = new Date();
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === 'quarter') {
    return (
      d.getFullYear() === now.getFullYear() &&
      Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3)
    );
  }
  return d.getFullYear() === now.getFullYear();
}

function escapeCsv(value: string | number | undefined) {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportInvoicesCsv(rows: InvoiceRow[], siteFilter: string, periodFilter: PeriodFilter) {
  const filterLine = `Filtres;${siteLabel(siteFilter)};${periodLabels[periodFilter]}\n`;
  const header =
    'N° facture;Date;Site;Client;Téléphone;Email;Total TTC (€);Renvois;Dernier renvoi\n';
  const body = rows
    .map((inv) =>
      [
        escapeCsv(inv.invoice_number),
        new Date(inv.sent_at).toLocaleString('fr-FR'),
        siteLabel(inv.site),
        escapeCsv(inv.customer_name || '-'),
        escapeCsv(inv.customer_phone || '-'),
        escapeCsv(inv.recipient_email),
        Number(inv.total_ttc).toFixed(2).replace('.', ','),
        inv.resent_count,
        inv.last_resent_at ? new Date(inv.last_resent_at).toLocaleString('fr-FR') : '-',
      ].join(';'),
    )
    .join('\n');

  const total = rows.reduce((sum, inv) => sum + Number(inv.total_ttc), 0);
  const summary = `\n\nTotal;${rows.length} facture(s);;;;;${total.toFixed(2).replace('.', ',')};;`;

  const csv = '\uFEFF' + filterLine + '\n' + header + body + summary;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportInvoicesPdf(rows: InvoiceRow[], siteFilter: string, periodFilter: PeriodFilter) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.text('Factures générées', 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Filtres : ${siteLabel(siteFilter)} · ${periodLabels[periodFilter]}`, 14, 28);

  const total = rows.reduce((sum, inv) => sum + Number(inv.total_ttc), 0);
  doc.text(
    `${rows.length} facture(s) — Total : ${total.toFixed(2).replace('.', ',')} €`,
    14,
    35
  );

  autoTable(doc, {
    head: [['N° facture', 'Date', 'Site', 'Client', 'Email', 'Total TTC', 'Renvois']],
    body: rows.map((inv) => [
      inv.invoice_number,
      new Date(inv.sent_at).toLocaleDateString('fr-FR'),
      siteLabel(inv.site),
      inv.customer_name || '-',
      inv.recipient_email,
      Number(inv.total_ttc).toFixed(2).replace('.', ',') + ' €',
      String(inv.resent_count),
    ]),
    startY: 40,
    theme: 'striped',
    headStyles: { fillColor: [234, 88, 12] },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  doc.save(`factures-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AdminInvoicesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAnyAdmin, isSuperAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<'all' | 'conches' | 'beaumont'>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isSuperAdmin) navigate('/admin');
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('sent_at', { ascending: false });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setInvoices((data as InvoiceRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAnyAdmin) fetchInvoices();
  }, [isAnyAdmin]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return invoices.filter((inv) => {
      if (siteFilter !== 'all' && inv.site !== siteFilter) return false;
      if (!matchesPeriod(inv.sent_at, periodFilter)) return false;
      if (!q) return true;
      const hay = normalize(
        [inv.customer_name, inv.customer_phone, inv.recipient_email, inv.invoice_number]
          .filter(Boolean)
          .join(' '),
      );
      return hay.includes(q);
    });
  }, [invoices, search, siteFilter, periodFilter]);

  const handleDownload = async (inv: InvoiceRow) => {
    try {
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(inv.storage_path, 60 * 5);
      if (error || !data?.signedUrl) throw error ?? new Error('URL indisponible');
      window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? 'Téléchargement impossible', variant: 'destructive' });
    }
  };

  const handleResend = async (inv: InvoiceRow) => {
    setBusyId(inv.id);
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from('invoices')
        .createSignedUrl(inv.storage_path, 60 * 60 * 24 * 30);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('URL indisponible');

      const orderDate = new Date(inv.sent_at).toLocaleDateString('fr-FR');
      const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'invoice',
          recipientEmail: inv.recipient_email,
          idempotencyKey: `invoice-resend-${inv.id}-${Date.now()}`,
          templateData: {
            customerName: inv.customer_name || 'Client',
            invoiceNumber: inv.invoice_number,
            orderDate,
            totalTTC: Number(inv.total_ttc).toFixed(2).replace('.', ',') + '€',
            downloadUrl: signed.signedUrl,
            companyName: inv.site === 'beaumont' ? 'Déclic Pizza Beaumont' : 'Déclic Pizza Conches',
          },
        },
      });
      if (mailErr) throw mailErr;

      await supabase
        .from('invoices')
        .update({
          resent_count: (inv.resent_count ?? 0) + 1,
          last_resent_at: new Date().toISOString(),
        })
        .eq('id', inv.id);

      toast({
        title: '📤 Facture renvoyée',
        description: `Facture ${inv.invoice_number} renvoyée à ${inv.recipient_email}.`,
      });
      fetchInvoices();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? 'Envoi impossible', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (inv: InvoiceRow) => {
    setBusyId(inv.id);
    try {
      // Best-effort remove of the stored PDF; ignore errors so a missing
      // object doesn't block deletion of the row.
      if (inv.storage_path) {
        await supabase.storage.from('invoices').remove([inv.storage_path]);
      }
      const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
      if (error) throw error;
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
      toast({
        title: '🗑️ Facture supprimée',
        description: `Facture ${inv.invoice_number} supprimée de l'historique.`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message ?? 'Suppression impossible', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!isAnyAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                <FileText className="h-5 w-5" /> Factures
              </h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} facture{filtered.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={loading || filtered.length === 0}>
                  <FileDown className="h-4 w-4 mr-1" /> Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => exportInvoicesCsv(filtered, siteFilter, periodFilter)}
                >
                  Exporter en CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportInvoicesPdf(filtered, siteFilter, periodFilter)}
                >
                  Exporter en PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, téléphone, email ou n° facture"
              className="pl-9"
            />
          </div>
          <Select value={siteFilter} onValueChange={(v: any) => setSiteFilter(v)}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les sites</SelectItem>
              <SelectItem value="conches">Conches</SelectItem>
              <SelectItem value="beaumont">Beaumont</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={(v: any) => setPeriodFilter(v)}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les périodes</SelectItem>
              <SelectItem value="month">Mois en cours</SelectItem>
              <SelectItem value="quarter">Trimestre en cours</SelectItem>
              <SelectItem value="year">Année en cours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucune facture trouvée.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((inv) => (
              <Card key={inv.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {inv.invoice_number}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(inv.sent_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {inv.site}
                      </Badge>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                        {Number(inv.total_ttc).toFixed(2).replace('.', ',')} €
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="font-medium">{inv.customer_name || 'Client'}</p>
                    <p className="text-muted-foreground">{inv.recipient_email}</p>
                    {inv.customer_phone && (
                      <p className="text-muted-foreground">{inv.customer_phone}</p>
                    )}
                    {inv.resent_count > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Renvoyée {inv.resent_count} fois
                        {inv.last_resent_at && ` — dernier envoi le ${new Date(inv.last_resent_at).toLocaleString('fr-FR')}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(inv)}>
                      <Download className="h-4 w-4 mr-1" /> Télécharger
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleResend(inv)}
                      disabled={busyId === inv.id}
                    >
                      {busyId === inv.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Renvoyer la facture
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === inv.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            La facture {inv.invoice_number} sera définitivement retirée de l'historique et le PDF associé supprimé du stockage. Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(inv)}
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
