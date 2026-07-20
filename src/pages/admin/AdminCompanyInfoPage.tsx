import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useCompanyInfo, CompanyInfo } from '@/hooks/useCompanyInfo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Save, Upload, Trash2, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import NotificationBell from '@/components/admin/NotificationBell';
import { toast } from '@/hooks/use-toast';

type Site = 'conches' | 'beaumont';

export default function AdminCompanyInfoPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    isAnyAdmin, isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont,
    loading: adminLoading,
  } = useAdmin();
  const { data, loading, upsert } = useCompanyInfo();

  const availableSites: Site[] = isSuperAdmin
    ? ['conches', 'beaumont']
    : [
        ...(isSiteAdminConches ? ['conches' as const] : []),
        ...(isSiteAdminBeaumont ? ['beaumont' as const] : []),
      ];

  const [site, setSite] = useState<Site>(availableSites[0] || 'conches');
  const [form, setForm] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isAnyAdmin) navigate('/');
    }
  }, [user, isAnyAdmin, authLoading, adminLoading, navigate]);

  useEffect(() => {
    if (availableSites.length && !availableSites.includes(site)) setSite(availableSites[0]);
  }, [availableSites, site]);

  useEffect(() => {
    const current = data[site];
    setForm({
      name: current?.name ?? '',
      siret: current?.siret ?? '',
      address: current?.address ?? '',
      phone: current?.phone ?? '',
      email: current?.email ?? '',
      logo_url: current?.logo_url ?? null,
    });
  }, [site, data]);

  // Load signed preview for the current site's logo
  useEffect(() => {
    let cancelled = false;
    const path = data[site]?.logo_url;
    if (!path) { setLogoPreview(null); return; }
    supabase.storage.from('company-logos').createSignedUrl(path, 60 * 60)
      .then(({ data: signed }) => {
        if (!cancelled) setLogoPreview(signed?.signedUrl ?? null);
      });
    return () => { cancelled = true; };
  }, [site, data]);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Format invalide', description: 'Choisissez une image (PNG, JPG, SVG).', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Fichier trop lourd', description: 'Le logo doit faire moins de 2 Mo.', variant: 'destructive' });
      return;
    }
    setLogoUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${site}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('company-logos')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      // Delete previous
      const prev = data[site]?.logo_url;
      if (prev && prev !== path) {
        await supabase.storage.from('company-logos').remove([prev]).catch(() => {});
      }
      await upsert(site, { logo_url: path });
      toast({ title: 'Logo mis à jour' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    const prev = data[site]?.logo_url;
    if (!prev) return;
    try {
      await supabase.storage.from('company-logos').remove([prev]).catch(() => {});
      await upsert(site, { logo_url: null });
      setLogoPreview(null);
      toast({ title: 'Logo supprimé' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert(site, {
        name: form.name?.trim() || null,
        siret: form.siret?.trim() || null,
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
      });
      toast({ title: 'Informations enregistrées' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const setField = (k: keyof CompanyInfo, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Informations de l'entreprise</h1>
              <p className="text-sm text-muted-foreground">Coordonnées affichées sur les tickets</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Site de pizzeria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Site</Label>
              <Select value={site} onValueChange={(v) => setSite(v as Site)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableSites.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nom de l'établissement</Label>
              <Input value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} placeholder="Déclic Pizza Conches" maxLength={120} />
            </div>

            <div className="space-y-2">
              <Label>SIRET / SIREN</Label>
              <Input value={form.siret ?? ''} onChange={(e) => setField('siret', e.target.value)} placeholder="123 456 789 00012" maxLength={32} />
            </div>

            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={form.address ?? ''} onChange={(e) => setField('address', e.target.value)} placeholder="12 rue de la Pizza, 27190 Conches" maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label>Numéro de téléphone</Label>
              <Input value={form.phone ?? ''} onChange={(e) => setField('phone', e.target.value)} placeholder="02 32 00 00 00" maxLength={30} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value)} placeholder="contact@declicpizza.fr" maxLength={120} />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
