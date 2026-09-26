import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellRing, Check, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { initNotificationSounds, isAudioUnlocked, playAlarmSound, getAlarmSettings, soundForSite, customSoundForSite, ALARM_SETTINGS_EVENT } from '@/lib/notificationSounds';

type Site = 'conches' | 'beaumont';
interface PendingOrder {
  id: string;
  site: string | null;
  restaurant: string;
  created_at: string;
  status: string;
  capture_status: string | null;
  acquittee_le: string | null;
}

const siteOf = (o: { site: string | null; restaurant: string }): Site | null => {
  const v = (o.site || o.restaurant || '').toLowerCase();
  if (v.includes('conches')) return 'conches';
  if (v.includes('beaumont')) return 'beaumont';
  return null;
};

/** Une commande « sonne » tant qu'elle est en attente, non acquittée et pas en cours/échec de paiement. */
const shouldRing = (o: PendingOrder) =>
  !o.acquittee_le &&
  o.status === 'pending' &&
  !['pending', 'failed', 'canceled', 'cancelled'].includes(o.capture_status ?? '');

const SITE_LABEL: Record<Site, string> = { conches: 'Conches', beaumont: 'Beaumont' };

export default function NewOrderAlarm() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, isSecondaryAdminConches, isSecondaryAdminBeaumont } =
    useAdmin();
  // Alarme active sur toutes les pages pour un compte admin (pas seulement /admin).
  const onAdmin = !pathname.startsWith('/livreur');

  const [prefs, setPrefs] = useState({ conches: true, beaumont: true });
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [unlocked, setUnlocked] = useState(false);

  // Sites autorisés = rôles admin ∩ réglage « Recevoir les alertes de » (Paramètres).
  const sites = useMemo(() => {
    const s: Site[] = [];
    if ((isSuperAdmin || isSiteAdminConches || isSecondaryAdminConches) && prefs.conches) s.push('conches');
    if ((isSuperAdmin || isSiteAdminBeaumont || isSecondaryAdminBeaumont) && prefs.beaumont) s.push('beaumont');
    return s;
  }, [isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, isSecondaryAdminConches, isSecondaryAdminBeaumont, prefs]);
  const active = onAdmin && !!user && sites.length > 0;
  const sitesKey = sites.join(',');

  useEffect(() => {
    if (!onAdmin || !user) return;
    supabase
      .from('admin_notification_prefs')
      .select('notify_conches, notify_beaumont')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => data && setPrefs({ conches: data.notify_conches, beaumont: data.notify_beaumont }));
  }, [onAdmin, user]);

  // Mise à jour immédiate quand le réglage « Recevoir les alertes de » change.
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d) setPrefs({ conches: d.notify_conches, beaumont: d.notify_beaumont });
    };
    window.addEventListener('admin-notification-prefs-changed', onChange);
    return () => window.removeEventListener('admin-notification-prefs-changed', onChange);
  }, []);

  // Chargement initial + Realtime INSERT/UPDATE (synchronise tous les onglets/postes).
  useEffect(() => {
    if (!active) {
      setOrders([]);
      return;
    }
    const allowed = new Set(sitesKey.split(','));
    const keep = (o: PendingOrder) => shouldRing(o) && allowed.has(siteOf(o) ?? '');
    let cancelled = false;

    supabase
      .from('orders')
      .select('id, site, restaurant, created_at, status, capture_status, acquittee_le')
      .is('acquittee_le', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setOrders((data as PendingOrder[]).filter(keep));
      });

    const upsert = (row: PendingOrder) =>
      setOrders((prev) => {
        const rest = prev.filter((o) => o.id !== row.id);
        return keep(row) ? [...rest, row].sort((a, b) => a.created_at.localeCompare(b.created_at)) : rest;
      });

    const channel = supabase
      .channel(`order-alarm-${sitesKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) =>
        upsert(p.new as PendingOrder),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (p) =>
        upsert(p.new as PendingOrder),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [active, sitesKey]);

  // Son en boucle tant qu'il reste au moins une commande non acquittée.
  const ringing = orders.length > 0;
  const [alarmSettings, setAlarmSettings] = useState(getAlarmSettings);
  useEffect(() => {
    const onChange = () => setAlarmSettings(getAlarmSettings());
    window.addEventListener(ALARM_SETTINGS_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(ALARM_SETTINGS_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  // Son du site de la commande la plus récente (réglage « un son par site »).
  const latestSite = orders.length ? siteOf(orders[orders.length - 1]) : null;
  useEffect(() => {
    if (!ringing || !unlocked) return;
    const s = { ...alarmSettings, sound: soundForSite(alarmSettings, latestSite) };
    const customUrl = customSoundForSite(alarmSettings, latestSite);
    let count = 1;
    playAlarmSound(s, customUrl);
    const t = window.setInterval(() => {
      if (s.repetitions > 0 && count >= s.repetitions) {
        window.clearInterval(t);
        return;
      }
      count++;
      playAlarmSound(s, customUrl);
    }, (s.duration + 1.5) * 1000);
    return () => window.clearInterval(t);
  }, [ringing, unlocked, orders.length, alarmSettings, latestSite]);

  useEffect(() => {
    if (!active) return;
    setUnlocked(isAudioUnlocked());
    const t = window.setInterval(() => setUnlocked(isAudioUnlocked()), 1500);
    return () => window.clearInterval(t);
  }, [active]);

  const enableSound = () => {
    initNotificationSounds();
    window.setTimeout(() => setUnlocked(isAudioUnlocked()), 200);
  };

  const acknowledge = useCallback(
    async (id: string) => {
      const by = user?.phone || user?.email || user?.id || null;
      const { error } = await supabase.rpc('acknowledge_order', { _order_id: id, _by: by });
      if (error) console.warn('Acquittement impossible:', error.message);
      // Retrait local immédiat ; les autres onglets sont synchronisés par l'événement UPDATE.
      else setOrders((prev) => prev.filter((o) => o.id !== id));
    },
    [user],
  );

  if (!active) return null;

  return (
    <>
      {!unlocked && !ringing && (
        <Button
          onClick={enableSound}
          className="fixed bottom-4 right-4 z-[60] min-h-11 shadow-lg"
          aria-label="Activer les alertes sonores"
        >
          <Volume2 className="h-4 w-4 mr-2" /> Activer les alertes sonores
        </Button>
      )}
      {ringing && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-0 inset-x-0 z-[60] bg-destructive text-destructive-foreground shadow-lg"
        >
          <div className="container mx-auto px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] space-y-2">
            <div className="flex flex-wrap items-center gap-2 font-bold text-lg">
              <BellRing className="h-6 w-6 animate-pulse" />
              {orders.length > 1 ? `${orders.length} nouvelles commandes !` : 'Nouvelle commande !'}
              {!unlocked && (
                <Button size="sm" variant="secondary" className="ml-auto min-h-11" onClick={enableSound}>
                  <Volume2 className="h-4 w-4 mr-2" /> Activer le son
                </Button>
              )}
            </div>
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
              {orders.map((o) => {
                const s = siteOf(o);
                return (
                  <li key={o.id} className="flex items-center gap-3 rounded-lg bg-background/15 px-3 py-2">
                    <span className="font-bold">
                      #{o.id.slice(0, 8).toUpperCase()} — {s ? SITE_LABEL[s] : o.restaurant}
                    </span>
                    <span className="text-sm opacity-90">
                      {new Date(o.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Europe/Paris',
                      })}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto min-h-11 font-bold"
                      onClick={() => acknowledge(o.id)}
                      aria-label={`J'ai vu la commande ${o.id.slice(0, 8)}`}
                    >
                      J'ai vu <Check className="h-4 w-4 ml-1" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
