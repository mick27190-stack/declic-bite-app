import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * "Mode test" : ouverture temporaire de la création de commandes en dehors des
 * horaires (18h-22h), réservée aux super admins pour valider le flux de
 * paiement en production. Le mode s'éteint tout seul à `active_until`, il ne
 * peut donc pas rester ouvert par oubli.
 */
export function useOrderTestMode() {
  const [activeUntil, setActiveUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const [rpcActive, setRpcActive] = useState(false);

  const load = useCallback(async () => {
    // Le détail (date d'expiration, admin ayant activé) est réservé aux admins ;
    // les clients n'obtiennent que le booléen via une fonction SECURITY DEFINER.
    const [{ data }, { data: active }] = await Promise.all([
      supabase.from('order_test_mode').select('active_until').maybeSingle(),
      supabase.rpc('is_order_test_mode_active'),
    ]);
    setActiveUntil(data?.active_until ?? null);
    setRpcActive(!!active);
    setLoading(false);
  }, []);


  useEffect(() => {
    load();

    const channel = supabase
      .channel(`order-test-mode-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_test_mode' },
        () => load(),
      )
      .subscribe();

    // Tick pour que l'expiration soit prise en compte sans rechargement.
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
    };
  }, [load]);

  const isTestModeActive = activeUntil
    ? new Date(activeUntil).getTime() > now
    : rpcActive;


  const enable = useCallback(
    async (minutes: number, userId?: string) => {
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      const { error } = await supabase
        .from('order_test_mode')
        .update({ active_until: until, enabled_by: userId ?? null, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (!error) setActiveUntil(until);
      return error;
    },
    [],
  );

  const disable = useCallback(async () => {
    const { error } = await supabase
      .from('order_test_mode')
      .update({ active_until: null, updated_at: new Date().toISOString() })
      .eq('id', true);
    if (!error) setActiveUntil(null);
    return error;
  }, []);

  return { activeUntil, isTestModeActive, loading, enable, disable };
}
