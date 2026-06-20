import { useState } from 'react';
import { BellRing, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { setupPushNotifications } from '@/lib/pushNotifications';
import { toast } from 'sonner';

const PUSH_CONFIGURED_KEY = 'push_notifications_configured';

/**
 * Push notification test panel.
 * Lets the signed-in user register their current device and fire a real FCM
 * push to themselves to verify background delivery on iOS / Android.
 *
 * Once the user has both enabled push on their device AND successfully sent a
 * test push, the panel hides itself for future visits/orders.
 */
export default function PushTestPanel() {
  const [registering, setRegistering] = useState(false);
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(
    () => localStorage.getItem(PUSH_CONFIGURED_KEY) === 'true'
  );
  const [lastResult, setLastResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  // Once enabled + tested successfully, never show this message again.
  if (configured) return null;

  const handleEnable = async () => {
    setRegistering(true);
    try {
      const token = await setupPushNotifications();
      if (token) {
        setEnabled(true);
        toast.success('Appareil enregistré pour les notifications push');
      } else {
        toast.error(
          "Impossible d'activer les notifications. Vérifiez l'autorisation du navigateur."
        );
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleTest = async () => {
    setSending(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-push');
      if (error) {
        setLastResult({ ok: false, message: error.message });
        toast.error("Échec de l'envoi du push de test");
        return;
      }
      setLastResult({ ok: !!data?.ok, message: data?.message ?? '' });
      if (data?.ok) {
        toast.success('Push de test envoyé !');
        // Mark as fully configured once the device is enabled and the test
        // push has been sent successfully, then hide the panel.
        if (enabled) {
          localStorage.setItem(PUSH_CONFIGURED_KEY, 'true');
          setConfigured(true);
        }
      } else {
        toast.warning(data?.message ?? 'Aucun appareil enregistré');
      }
    } catch (e: any) {
      setLastResult({ ok: false, message: String(e?.message ?? e) });
      toast.error("Échec de l'envoi du push de test");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card p-4 rounded-xl">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <BellRing className="w-5 h-5 text-primary" />
        Test des notifications push
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Activez les notifications sur cet appareil, puis envoyez un push de test.
        Mettez l'application en arrière-plan (ou verrouillez l'écran) avant
        d'appuyer sur « Envoyer un test » pour vérifier la réception sur iOS et
        Android.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleEnable}
          disabled={registering}
        >
          {registering ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <BellRing className="w-4 h-4 mr-1" />
          )}
          Activer sur cet appareil
        </Button>
        <Button className="flex-1" onClick={handleTest} disabled={sending}>
          {sending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <BellRing className="w-4 h-4 mr-1" />
          )}
          Envoyer un test
        </Button>
      </div>

      {lastResult && (
        <div
          className={`mt-3 flex items-start gap-2 text-sm rounded-lg p-3 ${
            lastResult.ok
              ? 'bg-green-500/10 text-green-600'
              : 'bg-amber-500/10 text-amber-600'
          }`}
        >
          {lastResult.ok ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{lastResult.message}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Sur iOS, les notifications push web nécessitent d'installer l'app sur
        l'écran d'accueil (« Ajouter à l'écran d'accueil ») et d'ouvrir cette
        version installée.
      </p>
    </div>
  );
}
