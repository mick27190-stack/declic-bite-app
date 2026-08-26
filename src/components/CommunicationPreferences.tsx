import { useEffect, useState } from 'react';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getLatestConsent, recordConsents } from '@/lib/consent';
import { useAuth } from '@/contexts/AuthContext';

export default function CommunicationPreferences() {
  const { user } = useAuth();
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      const value = await getLatestConsent('sms_marketing');
      if (!cancelled) {
        setSmsOptIn(value === true);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    const previous = smsOptIn;
    setSmsOptIn(checked);
    try {
      // Nouvelle ligne à chaque changement : l'historique n'est jamais modifié.
      await recordConsents([{ type_consentement: 'sms_marketing', accepte: checked }]);
      toast.success(
        checked
          ? 'Vous recevrez désormais nos offres par SMS.'
          : 'Vous ne recevrez plus nos offres par SMS.',
      );
    } catch {
      setSmsOptIn(previous);
      toast.error("Impossible d'enregistrer votre choix. Réessayez.");
    } finally {
      setSaving(false);
    }
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
    </div>
  );
}
