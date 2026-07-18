import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/webNotifications';
import { setupPushNotifications } from '@/lib/pushNotifications';
import { toast } from 'sonner';

const HIDE_KEY = 'notification_permission_reminder_dismissed';

// True when the app runs inside an iframe (Lovable preview, embed, etc.).
// Browsers refuse Notification.requestPermission() in cross-origin iframes and
// return 'denied' immediately without ever showing the system prompt.
function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function NotificationPermissionReminder() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission;
  });
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(HIDE_KEY) === 'true';
  });

  // Listen for permission changes while the profile page is open.
  useEffect(() => {
    if (!isNotificationSupported()) return;
    const handleChange = () => setPermission(Notification.permission);
    Notification.permission;
    // Some browsers fire the change event on the Notification constructor.
    try {
      (Notification as any).addEventListener?.('change', handleChange);
    } catch {
      // ignore
    }
    return () => {
      try {
        (Notification as any).removeEventListener?.('change', handleChange);
      } catch {
        // ignore
      }
    };
  }, []);

  if (permission === 'granted' || permission === 'unsupported' || dismissed) return null;

  const isDenied = permission === 'denied';

  const handleEnable = async () => {
    // Cross-origin iframes (Lovable preview, embeds) can't show the browser's
    // permission prompt — requestPermission() returns 'denied' immediately.
    // Guide the user to open the app in a real browser tab instead of
    // flipping the UI into the "blocked" state.
    if (isInIframe()) {
      toast.info(
        "Ouvrez l’application dans votre navigateur (ou installez-la sur votre écran d’accueil) pour activer les notifications.",
        { duration: 7000 }
      );
      return;
    }
    if (isDenied) {
      toast.error(
        'Vous avez bloqué les notifications. Veuillez les autoriser dans les paramètres de votre navigateur, puis revenez sur cette page.',
        { duration: 6000 }
      );
      return;
    }
    setLoading(true);
    try {
      const result = await requestNotificationPermission();
      if (result === 'granted') {
        setPermission(result);
        // Also register the device for FCM push if possible.
        await setupPushNotifications();
        toast.success('Notifications activées', {
          description: 'Vous recevrez désormais les alertes de votre restaurant.',
        });
      } else if (result === 'denied') {
        // Only reflect a real user refusal (prompt actually shown). If the
        // prompt was suppressed by the browser (iframe, insecure context…)
        // requestPermission() also returns 'denied' — keep the reminder in
        // the neutral "not granted yet" state and explain how to retry.
        setPermission(result);
        toast.error(
          "Vous avez refusé les notifications. Vous pourrez les autoriser plus tard dans les paramètres de votre navigateur.",
        );
      } else {
        // 'default' — user dismissed the prompt without choosing. Do nothing.
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(HIDE_KEY, 'true');
    }
  };

  return (
    <div className="glass-card p-4 rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          {isDenied ? (
            <BellOff className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Bell className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">
            {isDenied ? 'Notifications bloquées' : 'Activez les notifications'}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            {isDenied
              ? 'Vous avez désactivé les notifications. Pour être alerté des réponses du restaurant et du suivi de vos commandes, autorisez-les dans les paramètres de votre navigateur.'
              : 'Recevez une alerte dès que le restaurant vous répond ou met à jour votre commande, même lorsque l’application est fermée.'}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-1.5" />
              )}
              {isDenied ? 'Comment activer ?' : 'Activer les notifications'}
            </Button>
            {!isDenied && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                disabled={loading}
              >
                Plus tard
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
