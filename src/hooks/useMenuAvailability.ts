import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MenuSite = 'conches' | 'beaumont';

type SiteMap = Record<MenuSite, Record<string, boolean>>;

const emptyMap = (): SiteMap => ({ conches: {}, beaumont: {} });

export function useMenuAvailability() {
  const [map, setMap] = useState<SiteMap>(emptyMap());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_item_availability')
      .select('item_key, is_available, site');
    if (!error && data) {
      const next = emptyMap();
      for (const row of data as any[]) {
        const site = (row.site as MenuSite) ?? 'conches';
        if (site === 'conches' || site === 'beaumont') {
          next[site][row.item_key] = row.is_available;
        }
      }
      setMap(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('menu-availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_item_availability' },
        (payload) => {
          setMap((prev) => {
            const next: SiteMap = {
              conches: { ...prev.conches },
              beaumont: { ...prev.beaumont },
            };
            if (payload.eventType === 'DELETE') {
              const key = (payload.old as any)?.item_key;
              const site = (payload.old as any)?.site as MenuSite | undefined;
              if (key && site && (site === 'conches' || site === 'beaumont')) {
                delete next[site][key];
              }
              return next;
            }
            const row = payload.new as any;
            const site = row?.site as MenuSite | undefined;
            if (row?.item_key && site && (site === 'conches' || site === 'beaumont')) {
              next[site][row.item_key] = row.is_available;
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const isAvailable = useCallback(
    (itemKey: string, site?: MenuSite | string | null) => {
      if (site === 'conches' || site === 'beaumont') {
        return map[site][itemKey] !== false;
      }
      // No site specified: available if available on at least one site.
      return map.conches[itemKey] !== false || map.beaumont[itemKey] !== false;
    },
    [map]
  );

  const setAvailable = useCallback(
    async (itemKey: string, site: MenuSite, value: boolean) => {
      setMap((prev) => ({
        ...prev,
        [site]: { ...prev[site], [itemKey]: value },
      }));
      const { error } = await supabase
        .from('menu_item_availability')
        .upsert(
          {
            item_key: itemKey,
            site,
            is_available: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'item_key,site' }
        );
      if (error) {
        setMap((prev) => ({
          ...prev,
          [site]: { ...prev[site], [itemKey]: !value },
        }));
        throw error;
      }
    },
    []
  );

  return { map, isAvailable, setAvailable, loading, refresh: fetchAll };
}
