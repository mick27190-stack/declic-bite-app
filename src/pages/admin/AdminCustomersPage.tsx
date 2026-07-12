import { useState, useEffect, useCallback } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Phone, Search, Trash2, Users } from 'lucide-react';

interface Customer {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  site: string | null;
  source: string;
  created_at: string;
}

const formatPhone = (raw: string) => {
  let p = raw.replace(/[\s.-]/g, '');
  if (p.startsWith('0')) p = '+33' + p.slice(1);
  else if (p.startsWith('33')) p = '+' + p;
  else if (!p.startsWith('+') && p.length > 0) p = '+33' + p;
  return p;
};

export default function AdminCustomersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAnyAdmin, loading: adminLoading } = useAdmin();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

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
            <p className="text-sm text-muted-foreground">{customers.length} client(s) enregistré(s)</p>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun client trouvé</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Origine</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
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
                      <TableCell className="capitalize">{c.site || '—'}</TableCell>
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
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
