import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useRestaurantClosures } from '@/hooks/useRestaurantClosures';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, ShieldAlert, Calendar, FlaskConical, Power } from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';
import { useOrderTestMode } from '@/hooks/useOrderTestMode';
import { toast } from '@/hooks/use-toast';


export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, isAnyAdmin, loading: adminLoading } = useAdmin();
  const { closures, loading: closuresLoading, addClosure, toggleClosure, deleteClosure } = useRestaurantClosures();

  const [newSite, setNewSite] = useState('all');
  const [newType, setNewType] = useState<'orders' | 'site'>('orders');
  const [newReason, setNewReason] = useState('');
  const [newEndAt, setNewEndAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { activeUntil, isTestModeActive, enable: enableTestMode, disable: disableTestMode } = useOrderTestMode();
  const [testMinutes, setTestMinutes] = useState('30');
  const [testSubmitting, setTestSubmitting] = useState(false);

  // Tick à la seconde pour le compte à rebours du mode test.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!isTestModeActive) return;
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isTestModeActive]);

  const remainingMs = isTestModeActive && activeUntil
    ? Math.max(0, new Date(activeUntil).getTime() - nowTick)
    : 0;
  const totalSec = Math.floor(remainingMs / 1000);
  const countdownLabel = [
    totalSec >= 3600 ? Math.floor(totalSec / 3600) : null,
    Math.floor((totalSec % 3600) / 60),
    totalSec % 60,
  ]
    .filter((v): v is number => v !== null)
    .map((v) => String(v).padStart(2, '0'))
    .join(':');

  // Désactivation automatique : dès que le compte à rebours atteint zéro,
  // le mode redevient inactif (isTestModeActive repasse à false) et on
  // confirme immédiatement. On distingue l'expiration (activeUntil encore
  // renseigné) de la désactivation manuelle (activeUntil remis à null,
  // déjà confirmée par un toast dans handleToggleTestMode).
  const wasTestModeActive = useRef(false);
  useEffect(() => {
    if (wasTestModeActive.current && !isTestModeActive && activeUntil) {
      toast({
        title: 'Mode test terminé',
        description: 'Le délai est écoulé : les horaires normaux (18h–22h) sont de nouveau appliqués.',
      });
    }
    wasTestModeActive.current = isTestModeActive;
  }, [isTestModeActive, activeUntil]);

  const handleToggleTestMode = async (checked: boolean) => {
    setTestSubmitting(true);
    const error = checked
      ? await enableTestMode(Number(testMinutes) || 30, user?.id)
      : await disableTestMode();
    setTestSubmitting(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: checked ? 'Mode test activé' : 'Mode test désactivé',
      description: checked
        ? `Les commandes sont ouvertes pendant ${Number(testMinutes) || 30} minutes.`
        : 'Les horaires normaux (18h-22h) sont de nouveau appliqués.',
    });
  };

  useEffect(() => {
    if (!authLoading && !adminLoading) {

      if (!user) navigate('/auth');
      else if (!isAnyAdmin) navigate('/');
    }
  }, [user, isAnyAdmin, authLoading, adminLoading]);

  const handleAdd = async () => {
    if (!newReason.trim() || !user) return;
    setSubmitting(true);
    await addClosure({
      site: newSite,
      closure_type: newType,
      reason: newReason.trim(),
      end_at: newEndAt || null,
      created_by: user.id,
    });
    setNewReason('');
    setNewEndAt('');
    setSubmitting(false);
  };

  // Determine which sites this admin can manage
  const availableSites = isSuperAdmin
    ? [{ value: 'all', label: 'Tous les sites' }, { value: 'conches', label: 'Conches' }, { value: 'beaumont', label: 'Beaumont' }]
    : isSiteAdminConches
    ? [{ value: 'conches', label: 'Conches' }]
    : isSiteAdminBeaumont
    ? [{ value: 'beaumont', label: 'Beaumont' }]
    : [];

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const siteLabel = (site: string) => {
    if (site === 'all') return 'Tous les sites';
    return site.charAt(0).toUpperCase() + site.slice(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Paramètres</h1>
              <p className="text-sm text-muted-foreground">Blocage des commandes</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Mode test : ouverture temporaire hors horaires (super admin) */}
        {isSuperAdmin && (
          <Card className={isTestModeActive ? 'border-amber-500/50 bg-amber-500/5' : undefined}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-amber-600" />
                Mode test (hors horaires)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ouvre temporairement la création de commandes en dehors de 18h–22h (et le lundi)
                pour tester le paiement en production. Les fermetures et blocages de site restent
                appliqués. Le mode s'éteint automatiquement à la fin du délai.
              </p>

              <div className="space-y-2">
                <Label>Durée</Label>
                <Select value={testMinutes} onValueChange={setTestMinutes} disabled={isTestModeActive}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 heure</SelectItem>
                    <SelectItem value="120">2 heures</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {isTestModeActive ? 'Mode test actif' : 'Mode test désactivé'}
                  </p>
                  {isTestModeActive && activeUntil && (
                    <p className="text-xs text-muted-foreground">
                      Jusqu'à{' '}
                      {new Date(activeUntil).toLocaleTimeString('fr-FR', {
                        timeZone: 'Europe/Paris',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      (heure de Paris)
                    </p>
                  )}
                </div>
              </div>

              <Button
                  type="button"
                  variant={isTestModeActive ? 'destructive' : 'default'}
                  className="w-full"
                  disabled={testSubmitting}
                  onClick={() => handleToggleTestMode(!isTestModeActive)}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {testSubmitting
                    ? 'Mise à jour…'
                    : isTestModeActive
                      ? `Mode test actif — ${countdownLabel} restantes (désactiver)`
                      : `Activer le mode test pendant ${testMinutes === '60' ? '1 heure' : testMinutes === '120' ? '2 heures' : `${testMinutes} minutes`}`}
                </Button>

              {isTestModeActive && (
                <p className="text-xs text-amber-700">
                  ⚠️ De vrais clients peuvent commander pendant cette fenêtre. Désactivez le mode
                  dès la fin du test.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add new closure */}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              {newType === 'site' ? 'Fermeture du/des sites' : 'Bloquer les commandes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type de blocage</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as 'orders' | 'site')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Blocage des commandes</SelectItem>
                  <SelectItem value="site">Fermeture du/des sites</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newType === 'site'
                  ? 'Commandes en ligne bloquées et bouton d’appel désactivé pour le(s) site(s) concerné(s).'
                  : 'Commandes en ligne bloquées, les clients peuvent toujours appeler le site.'}
              </p>
            </div>

            <div className="space-y-2">

              <Label>Site concerné</Label>
              <Select value={newSite} onValueChange={setNewSite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Message affiché aux clients</Label>
              <Textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Ex: Fermeture exceptionnelle pour congés du 15 au 22 août."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date de fin (optionnel)
              </Label>
              <Input
                type="datetime-local"
                value={newEndAt}
                onChange={(e) => setNewEndAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour un blocage jusqu'à désactivation manuelle.
              </p>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!newReason.trim() || submitting}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Activer le blocage
            </Button>
          </CardContent>
        </Card>

        {/* Active closures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blocages en cours</CardTitle>
          </CardHeader>
          <CardContent>
            {closuresLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : closures.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun blocage actif. Les commandes sont ouvertes.
              </p>
            ) : (
              <div className="space-y-3">
                {closures.map((closure) => (
                  <div
                    key={closure.id}
                    className={`rounded-lg border p-4 space-y-2 ${
                      closure.is_active ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={closure.is_active ? 'destructive' : 'secondary'} className="text-xs">
                            {closure.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {siteLabel(closure.site)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {closure.closure_type === 'site' ? 'Fermeture du site' : 'Blocage des commandes'}
                          </Badge>

                        </div>
                        <p className="text-sm text-foreground">{closure.reason}</p>
                        {closure.end_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Jusqu'au {new Date(closure.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={closure.is_active}
                          onCheckedChange={(checked) => toggleClosure(closure.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteClosure(closure.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
