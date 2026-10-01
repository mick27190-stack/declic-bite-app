import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MailWarning, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import NotificationBell from '@/components/admin/NotificationBell';

interface Item {
  email: string;
  template: string;
  status: string;
  error: string | null;
  failed_at: string;
  user_id: string | null;
  phone: string | null;
  state: 'verified' | 'pending' | 'unknown';
}

const STATE_LABEL: Record<Item['state'], string> = {
  pending: 'En attente de validation',
  verified: 'Validée depuis',
  unknown: 'Compte introuvable',
};

export default function AdminEmailVerificationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) navigate('/auth');
      else if (!isSuperAdmin) navigate('/admin');
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-email-verifications', { body: { action: 'list' } });
    if (error || data?.error) {
      toast({ title: 'Chargement impossible', description: data?.error ?? error?.message, variant: 'destructive' });
    } else setItems(data.items ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const resend = async (email: string) => {
    setSending(email);
    const { data, error } = await supabase.functions.invoke('admin-email-verifications', { body: { action: 'resend', email } });
    setSending(null);
    if (error || data?.error) {
      toast({ title: 'Envoi impossible', description: data?.error ?? error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: data.message ?? 'Lien envoyé' });
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} aria-label="Retour">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Validations e-mail en échec</h1>
              <p className="text-sm text-muted-foreground">Liens de validation d'adresse non délivrés</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <MailWarning className="h-8 w-8 mx-auto mb-2 text-primary" />
            Aucun e-mail de validation en échec.
          </CardContent></Card>
        ) : (
          items.map((it) => (
            <Card key={it.email}>
              <CardContent className="py-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold break-all">{it.email}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{it.template === 'email_change' ? "Changement d'adresse" : 'Inscription'}</Badge>
                    <Badge variant={it.state === 'pending' ? 'destructive' : 'outline'}>{STATE_LABEL[it.state]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Échec le {new Date(it.failed_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
                    {it.phone ? ` · Tél. ${it.phone}` : ''}
                  </p>
                  {it.error && <p className="text-xs text-muted-foreground">Motif : {it.error}</p>}
                </div>
                <Button
                  onClick={() => resend(it.email)}
                  disabled={sending === it.email || it.state !== 'pending'}
                  className="shrink-0"
                >
                  {sending === it.email ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Renvoyer le lien
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
