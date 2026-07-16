import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft, UserPlus, Phone, Search, Trash2, Users, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Customer {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  site: string | null;
  source: string;
  created_at: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatPhone = (raw: string) => {
  let p = raw.replace(/[\s.-]/g, '');
  if (p.startsWith('0')) p = '+33' + p.slice(1);
  else if (p.startsWith('33')) p = '+' + p;
  else if (!p.startsWith('+') && p.length > 0) p = '+33' + p;
  return p;
};

const siteLabel = (s: string | null) => {
  if (s === 'conches') return 'Conches-en-Ouche';
  if (s === 'beaumont') return 'Beaumont-le-Roger';
  return '—';
};

export default function AdminCustomersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAnyAdmin, loading: adminLoading } = useAdmin();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [site, setSite] = useState<string>('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Erreur lors du chargement du fichier client');
    } else {
      setCustomers((data || []) as Customer[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isAnyAdmin) navigate('/admin');
      else fetchCustomers();
    }
  }, [user, isAnyAdmin, authLoading, adminLoading, navigate, fetchCustomers]);

  useEffect(() => {
    if (!user || !isAnyAdmin) return;
    const channel = supabase
      .channel('admin-customers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => fetchCustomers()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAnyAdmin, fetchCustomers]);

  const conchesCount = customers.filter((c) => c.site === 'conches').length;
  const beaumontCount = customers.filter((c) => c.site === 'beaumont').length;

  const resetForm = () => {
    setFirstName(''); setLastName(''); setPhone(''); setEmail(''); setSite('');
  };

  const handleCreate = async () => {
    if (!phone.trim()) {
      toast.error('Le numéro de téléphone est obligatoire');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('customers').insert({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      phone: formatPhone(phone),
      email: email.trim() || null,
      site: site || null,
      source: 'manual',
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la création du client");
    } else {
      toast.success('Client ajouté au fichier client');
      resetForm();
      setDialogOpen(false);
      fetchCustomers();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast.error('Erreur lors de la suppression');
    else {
      toast.success('Client supprimé');
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const filtered = useMemo(() => {
    const n = nameFilter.trim().toLowerCase();
    const e = emailFilter.trim().toLowerCase();
    const a = addressFilter.trim().toLowerCase();
    return customers.filter((c) => {
      const fullName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim().toLowerCase();
      if (n && !fullName.includes(n)) return false;
      if (e && !(c.email ?? '').toLowerCase().includes(e)) return false;
      if (a && !(c.address ?? '').toLowerCase().includes(a)) return false;
      if (siteFilter !== 'all' && c.site !== siteFilter) return false;
      return true;
    });
  }, [customers, nameFilter, emailFilter, addressFilter, siteFilter]);

  // Reset to first page whenever filters or page size change
  useEffect(() => {
    setPage(1);
  }, [nameFilter, emailFilter, addressFilter, siteFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  const buildRows = (rows: Customer[]) =>
    rows.map((c) => [
      [c.first_name, c.last_name].filter(Boolean).join(' ') || '—',
      c.phone || '—',
      c.email || '—',
      c.address || '—',
      siteLabel(c.site),
      c.source === 'registration' ? 'Inscription' : 'Manuel',
      new Date(c.created_at).toLocaleDateString('fr-FR'),
    ]);

  const activeFilterSummary = () => {
    const parts: string[] = [];
    if (nameFilter.trim()) parts.push(`nom="${nameFilter.trim()}"`);
    if (emailFilter.trim()) parts.push(`email="${emailFilter.trim()}"`);
    if (addressFilter.trim()) parts.push(`adresse="${addressFilter.trim()}"`);
    if (siteFilter !== 'all') parts.push(`site=${siteLabel(siteFilter)}`);
    parts.push(`page ${currentPage}/${totalPages}`);
    return parts.join(' • ');
  };

  const exportCSV = (rows: Customer[], scope: 'page' | 'all') => {
    if (rows.length === 0) {
      toast.error('Aucun client à exporter');
      return;
    }
    const headers = ['Nom', 'Téléphone', 'Email', 'Adresse', 'Site', 'Origine', 'Créé le'];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(','),
      ...buildRows(rows).map((r) => r.map((v) => escape(String(v))).join(',')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = scope === 'page' ? `_p${currentPage}` : '_tous';
    a.download = `clients_${new Date().toISOString().slice(0, 10)}${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} client(s) exportés en CSV`);
  };

  const exportPDF = (rows: Customer[], scope: 'page' | 'all') => {
    if (rows.length === 0) {
      toast.error('Aucun client à exporter');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Déclic Pizza — Fichier client', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const scopeLabel = scope === 'page' ? `page ${currentPage}/${totalPages}` : 'tous filtres appliqués';
    doc.text(
      `Export du ${new Date().toLocaleString('fr-FR')} — ${rows.length} client(s) — ${activeFilterSummary()} — ${scopeLabel}`,
      14,
      21,
    );
    autoTable(doc, {
      startY: 26,
      head: [['Nom', 'Téléphone', 'Email', 'Adresse', 'Site', 'Origine', 'Créé le']],
      body: buildRows(rows),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [234, 88, 12] },
    });
    const suffix = scope === 'page' ? `_p${currentPage}` : '_tous';
    doc.save(`clients_${new Date().toISOString().slice(0, 10)}${suffix}.pdf`);
    toast.success(`${rows.length} client(s) exportés en PDF`);
  };

  if (authLoading || adminLoading || loading) {
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
          <div>
            <h1 className="text-xl font-bold text-primary">Fichier Client</h1>
            <p className="text-sm text-muted-foreground">
              {customers.length} client(s) enregistré(s)
              <span className="ml-2 inline-flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Conches : {conchesCount}</Badge>
                <Badge variant="outline" className="text-xs">Beaumont : {beaumontCount}</Badge>
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Clients
                </CardTitle>
                <CardDescription>
                  Tous les clients inscrits et ajoutés manuellement
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Page courante</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => exportCSV(paginated, 'page')}>
                      CSV — page ({paginated.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDF(paginated, 'page')}>
                      PDF — page ({paginated.length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Tous les filtres</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => exportCSV(filtered, 'all')}>
                      CSV — tous ({filtered.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDF(filtered, 'all')}>
                      PDF — tous ({filtered.length})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Ajouter un client
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouveau client</DialogTitle>
                      <DialogDescription>
                        Ajoutez un client directement au fichier client.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Prénom</Label>
                          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Nom</Label>
                          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Téléphone *</Label>
                        <Input id="phone" type="tel" placeholder="06 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Site</Label>
                        <Select value={site} onValueChange={setSite}>
                          <SelectTrigger>
                            <SelectValue placeholder="Aucun site" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conches">Conches-en-Ouche</SelectItem>
                            <SelectItem value="beaumont">Beaumont-le-Roger</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                      <Button onClick={handleCreate} disabled={saving}>
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par adresse..."
                  value={addressFilter}
                  onChange={(e) => setAddressFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les sites</SelectItem>
                  <SelectItem value="conches">Conches-en-Ouche</SelectItem>
                  <SelectItem value="beaumont">Beaumont-le-Roger</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun client trouvé</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Adresse</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                        </TableCell>
                        <TableCell>
                          {c.phone ? (
                            <a
                              href={`tel:${c.phone.replace(/\s/g, '')}`}
                              className="inline-flex items-center gap-1 text-primary font-medium hover:underline underline-offset-2"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {c.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">{c.email || '—'}</TableCell>
                        <TableCell>{siteLabel(c.site)}</TableCell>
                        <TableCell>
                          <Badge variant={c.source === 'registration' ? 'default' : 'outline'}>
                            {c.source === 'registration' ? 'Inscription' : 'Manuel'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
                  <div className="text-sm text-muted-foreground">
                    {filtered.length} résultat(s) • affichage {pageStart + 1}–
                    {Math.min(pageStart + pageSize, filtered.length)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
