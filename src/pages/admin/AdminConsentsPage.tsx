import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
import ConsentMigrationStats from '@/components/admin/ConsentMigrationStats';
import { LEGAL_DOCS_VERSION } from '@/lib/consent';

interface ConsentRow {
  id: string;
  client_id: string;
  type_consentement: string;
  accepte: boolean;
  version_document: string | null;
  date_consentement: string;
  adresse_ip: string | null;
}

interface ProfileInfo {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const TYPE_LABELS: Record<string, string> = {
  cgv_politique: 'CGV & Confidentialité',
  sms_marketing: 'SMS marketing',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
};

export default function AdminConsentsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [versionFilter, setVersionFilter] = useState<string>(LEGAL_DOCS_VERSION);
  const [typeFilter, setTypeFilter] = useState<'all' | 'cgv_politique' | 'sms_marketing'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isSuperAdmin) navigate('/admin');
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('consentements')
      .select('*')
      .order('date_consentement', { ascending: false });

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const list = (data as ConsentRow[]) ?? [];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.client_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, email')
        .in('user_id', ids);
      const map: Record<string, ProfileInfo> = {};
      (profs ?? []).forEach((p: any) => {
        map[p.user_id] = {
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          email: p.email,
        };
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchData();
  }, [isSuperAdmin]);

  const versions = useMemo(() => {
    const set = new Set<string>([LEGAL_DOCS_VERSION]);
    rows.forEach((r) => r.version_document && set.add(r.version_document));
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return rows.filter((r) => {
      if (versionFilter !== 'all' && (r.version_document ?? '') !== versionFilter) return false;
      if (typeFilter !== 'all' && r.type_consentement !== typeFilter) return false;
      const ts = new Date(r.date_consentement).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      if (!q) return true;
      const p = profiles[r.client_id];
      const hay = normalize(
        [p?.first_name, p?.last_name, p?.phone, p?.email, r.client_id].filter(Boolean).join(' '),
      );
      return hay.includes(q);
    });
  }, [rows, profiles, search, versionFilter, typeFilter, fromDate, toDate]);

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast({ title: 'Aucun consentement à exporter', variant: 'destructive' });
      return;
    }
    const header = [
      'Client',
      'Téléphone',
      'Email',
      'ID client',
      'Type de consentement',
      'Accepté',
      'Version du document',
      'Date de consentement (Paris)',
      'Adresse IP',
    ];
    const lines = filtered.map((r) => {
      const p = profiles[r.client_id];
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
      return [
        name,
        p?.phone ?? '',
        p?.email ?? '',
        r.client_id,
        TYPE_LABELS[r.type_consentement] ?? r.type_consentement,
        r.accepte ? 'Oui' : 'Non',
        r.version_document ?? '',
        formatDate(r.date_consentement),
        r.adresse_ip ?? '',
      ].map(csvCell).join(';');
    });

    const csv = '\uFEFF' + [header.map(csvCell).join(';'), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consentements_${versionFilter === 'all' ? 'toutes-versions' : versionFilter}_${
      new Date().toISOString().slice(0, 10)
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export CSV généré', description: `${filtered.length} ligne(s) exportée(s).` });
  };

  if (authLoading || adminLoading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              <h1 className="text-xl font-bold text-primary">Consentements RGPD</h1>
              <p className="text-sm text-muted-foreground">Registre et export</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <ConsentMigrationStats />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Registre des consentements
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button size="sm" onClick={handleExportCsv} disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                Exporter en CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Nom, téléphone, email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={versionFilter} onValueChange={setVersionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les versions</SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                      {v === LEGAL_DOCS_VERSION ? ' (courante)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="cgv_politique">CGV & Confidentialité</SelectItem>
                  <SelectItem value="sms_marketing">SMS marketing</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {filtered.length} consentement(s) affiché(s) sur {rows.length}
            </p>

            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun consentement pour ces filtres.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Client</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Choix</th>
                      <th className="py-2 pr-4 font-medium">Version</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const p = profiles[r.client_id];
                      const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
                      return (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <div className="font-medium">{name || '—'}</div>
                            <div className="text-xs text-muted-foreground">
                              {p?.phone ?? p?.email ?? r.client_id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            {TYPE_LABELS[r.type_consentement] ?? r.type_consentement}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={r.accepte ? 'default' : 'secondary'}>
                              {r.accepte ? 'Accepté' : 'Refusé'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">{r.version_document ?? '—'}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {formatDate(r.date_consentement)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
