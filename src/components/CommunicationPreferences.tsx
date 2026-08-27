import { useEffect, useState } from 'react';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getLatestConsent, recordConsents } from '@/lib/consent';
import { useAuth } from '@/contexts/AuthContext';

const REFUSAL_REASONS = [
  { value: 'trop_de_messages', label: 'Trop de messages' },
  { value: 'non_pertinent', label: 'Offres non pertinentes' },
  { value: 'plus_de_promos', label: 'Ne souhaite plus de publicité' },
  { value: 'autre', label: 'Autre' },
];

export default function CommunicationPreferences() {
  const { user } = useAuth();
  const [smsOptIn, setSmsOptIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRefusalForm, setShowRefusalForm] = useState(false);
  const [refusalReason, setRefusalReason] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(true);
      return;
    }

    const refresh = async () => {
      const value = await getLatestConsent('sms_marketing');
      if (!cancelled) {
        setSmsOptIn(value);
        setLoading(false);
      }
    };

    setLoading(true);
    void refresh();

    // Resynchronisation automatique : la désinscription/réinscription se
    // reflète immédiatement si le consentement change depuis un autre écran.
    const channel = supabase
      .channel(`consent-sms-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consentements',
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    // Rafraîchit aussi quand l'utilisateur revient sur l'onglet.
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [user]);


  const handleToggle = async (checked: boolean) => {
    if (checked) {
      // Réinscription : pas de motif, on enregistre immédiatement.
      setSaving(true);
      const previous = smsOptIn;
      setSmsOptIn(true);
      try {
        await recordConsents([{ type_consentement: 'sms_marketing', accepte: true }]);
        toast.success('Vous recevrez désormais nos offres par SMS.');
      } catch {
        setSmsOptIn(previous);
        toast.error("Impossible d'enregistrer votre choix. Réessayez.");
      } finally {
        setSaving(false);
      }
      return;
    }
    // Désinscription : on demande un motif optionnel avant d'enregistrer.
    setShowRefusalForm(true);
  };

  const confirmRefusal = async () => {
    setSaving(true);
    const previous = smsOptIn;
    setSmsOptIn(false);
    try {
      const motif = REFUSAL_REASONS.find((r) => r.value === refusalReason)?.label ?? null;
      await recordConsents([
        { type_consentement: 'sms_marketing', accepte: false, motif_refus: motif ?? undefined },
      ]);
      toast.success('Vous ne recevrez plus nos offres par SMS.');
      setShowRefusalForm(false);
      setRefusalReason('');
    } catch {
      setSmsOptIn(previous);
      toast.error("Impossible d'enregistrer votre choix. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const cancelRefusal = () => {
    setShowRefusalForm(false);
    setRefusalReason('');
    // Le switch reste sur ON puisque la désinscription est annulée.
    setSmsOptIn(true);
  };

  return (
    <div className="glass-card p-4 rounded-xl">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <MessageSquareText className="w-5 h-5 text-primary" />
        Mes préférences de communication
      </h3>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">SMS promotionnels</p>
          <p className="text-sm text-muted-foreground mt-1">
            Recevoir par SMS les offres promotionnelles et actualités de Déclic Pizza.
            Vous pouvez vous désinscrire à tout moment.
          </p>
          {!loading && (
            <p className="text-xs text-muted-foreground mt-2">
              Statut actuel : {smsOptIn ? 'inscrit' : 'non inscrit'}
            </p>
          )}
        </div>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-1" />
        ) : (
          <Switch
            checked={smsOptIn}
            disabled={saving}
            onCheckedChange={handleToggle}
            aria-label="Recevoir les SMS promotionnels"
          />
        )}
      </div>

      {showRefusalForm && (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Pourquoi souhaitez-vous vous désinscrire ?</p>
          <p className="text-xs text-muted-foreground">
            Ce motif est facultatif et nous aide à améliorer nos communications.
          </p>
          <Select value={refusalReason} onValueChange={setRefusalReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir un motif (facultatif)" />
            </SelectTrigger>
            <SelectContent>
              {REFUSAL_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancelRefusal} disabled={saving}>
              Annuler
            </Button>
            <Button size="sm" onClick={confirmRefusal} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
