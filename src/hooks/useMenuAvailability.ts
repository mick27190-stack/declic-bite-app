import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMenuAvailability() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_item_availability')
      .select('item_key, is_available');
    if (!error && data) {
      const next: Record<string, boolean> = {};
      for (const row of data) next[row.item_key] = row.is_available;
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
            const next = { ...prev };
            if (payload.eventType === 'DELETE') {
              const key = (payload.old as any)?.item_key;
              if (key) delete next[key];
            } else {
              const row = payload.new as any;
              if (row?.item_key) next[row.item_key] = row.is_available;
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
    (itemKey: string) => map[itemKey] !== false,
    [map]
  );

  const setAvailable = useCallback(async (itemKey: string, value: boolean) => {
    setMap((prev) => ({ ...prev, [itemKey]: value }));
    const { error } = await supabase
      .from('menu_item_availability')
      .upsert(
        { item_key: itemKey, is_available: value, updated_at: new Date().toISOString() },
        { onConflict: 'item_key' }
      );
    if (error) {
      setMap((prev) => ({ ...prev, [itemKey]: !value }));
      throw error;
    }
  }, []);

  return { map, isAvailable, setAvailable, loading, refresh: fetchAll };
}
