import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RestaurantClosure {
  id: string;
  site: string;
  is_active: boolean;
  reason: string;
  end_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Subscribe to restaurant_closures changes with automatic reconnection and
 * state resync after a Realtime disconnection (network drop, tab sleep, etc.).
 * Returns a cleanup function.
 */
function subscribeWithReconnect(scope: string, resync: () => void) {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let retry = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed || retryTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** retry);
    retry += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (disposed) return;
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }

    channel = supabase
      .channel(`restaurant_closures_${scope}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_closures' },
        () => resync()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          retry = 0;
          clearRetry();
          // Resync: events may have been missed while disconnected
          resync();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect();
        }
      });
  };

  const reconnectNow = () => {
    if (disposed) return;
    retry = 0;
    clearRetry();
    resync();
    connect();
  };

  const onOnline = () => reconnectNow();
  const onVisible = () => {
    if (document.visibilityState === 'visible') reconnectNow();
  };

  connect();
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    disposed = true;
    clearRetry();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    if (channel) supabase.removeChannel(channel);
  };
}

export function useRestaurantClosures() {
  const [closures, setClosures] = useState<RestaurantClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClosures = useCallback(async () => {
    const { data } = await supabase
      .from('restaurant_closures')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const now = new Date();
      const expiredActiveIds = (data as RestaurantClosure[])
        .filter(c => c.is_active && c.end_at && new Date(c.end_at) <= now)
        .map(c => c.id);

      if (expiredActiveIds.length > 0) {
        await supabase
          .from('restaurant_closures')
          .update({ is_active: false })
          .in('id', expiredActiveIds);
      }

      const updated = (data as RestaurantClosure[]).map(c =>
        expiredActiveIds.includes(c.id) ? { ...c, is_active: false } : c
      );
      setClosures(updated);
    }
    setLoading(false);
  }, []);

  // Re-check periodically so an open admin page auto-deactivates expired blocks
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClosures();
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchClosures]);

  const addClosure = async (closure: { site: string; reason: string; end_at?: string | null; created_by: string }) => {
    const { error } = await supabase
      .from('restaurant_closures')
      .insert({
        site: closure.site,
        reason: closure.reason,
        end_at: closure.end_at || null,
        created_by: closure.created_by,
        is_active: true,
      });
    if (!error) await fetchClosures();
    return { error };
  };

  const toggleClosure = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from('restaurant_closures')
      .update({ is_active })
      .eq('id', id);
    if (!error) await fetchClosures();
    return { error };
  };

  const deleteClosure = async (id: string) => {
    const { error } = await supabase
      .from('restaurant_closures')
      .delete()
      .eq('id', id);
    if (!error) await fetchClosures();
    return { error };
  };

  useEffect(() => {
    fetchClosures();
    return subscribeWithReconnect('admin', fetchClosures);
  }, [fetchClosures]);

  return { closures, loading, addClosure, toggleClosure, deleteClosure, refresh: fetchClosures };
}

/** Customer-facing hook: fetch only active closures without auth (live-synced) */
export function useActiveClosures() {
  const [closures, setClosures] = useState<RestaurantClosure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    const { data } = await supabase
      .from('restaurant_closures')
      .select('*')
      .eq('is_active', true);

    if (data) {
      // Filter out expired closures
      const now = new Date();
      const active = (data as RestaurantClosure[]).filter(c => !c.end_at || new Date(c.end_at) > now);
      setClosures(active);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActive();

    // Instant sync when an admin creates/toggles/deletes a block
    const channel = supabase
      .channel(`restaurant_closures_public_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_closures' },
        () => {
          fetchActive();
        }
      )
      .subscribe();

    // Re-check expirations, and resync when the tab becomes visible again
    const interval = setInterval(fetchActive, 30_000);
    const onWake = () => {
      if (document.visibilityState === 'visible') fetchActive();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', fetchActive);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', fetchActive);
    };
  }, [fetchActive]);

  const getClosureForSite = (site: string): RestaurantClosure | null => {
    // Check 'all' first, then specific site
    const allClosure = closures.find(c => c.site === 'all');
    if (allClosure) return allClosure;

    const normalized = site.toLowerCase().includes('conches') ? 'conches' : site.toLowerCase().includes('beaumont') ? 'beaumont' : site;
    return closures.find(c => c.site === normalized) || null;
  };

  return { closures, loading, getClosureForSite };
}
