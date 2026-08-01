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

    const channel = supabase
      .channel(`restaurant_closures_admin_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_closures' },
        () => {
          fetchClosures();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
