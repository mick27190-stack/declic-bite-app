import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useLiveParisTime } from '@/hooks/useLiveParisTime';
import { parisMinutes } from '@/lib/pickupSlots';
import {
  DayOpeningHours,
  DEFAULT_WINDOW,
  ServiceWindow,
  SiteId,
  parisDayOfWeek,
  referenceWindow,
  windowsForDay,
} from '@/lib/openingHours';

export function restaurantToSite(restaurant: string | null | undefined): SiteId {
  return (restaurant ?? '').toLowerCase().includes('beaumont') ? 'beaumont' : 'conches';
}

/** Repli utilisé tant que les horaires ne sont pas chargés : 18h-22h, fermé le lundi. */
function fallbackWindows(dow: number): ServiceWindow[] {
  return dow === 1 ? [] : [DEFAULT_WINDOW];
}

/**
 * Horaires d'ouverture des deux établissements, tenus à jour en temps réel.
 */
export function useOpeningHours() {
  const [rows, setRows] = useState<DayOpeningHours[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from('site_opening_hours')
      .select('site, day_of_week, is_closed, slot1_start, slot1_end, slot2_start, slot2_end');
    if (data) setRows(data as unknown as DayOpeningHours[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
    const channel = supabase
      .channel(`site_opening_hours_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_opening_hours' },
        () => fetchRows(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  const getWindows = useCallback(
    (site: SiteId, dow: number): ServiceWindow[] => {
      if (!rows) return fallbackWindows(dow);
      const row = rows.find((r) => r.site === site && r.day_of_week === dow);
      if (!row) return fallbackWindows(dow);
      return windowsForDay(row);
    },
    [rows],
  );

  const getRow = useCallback(
    (site: SiteId, dow: number) => rows?.find((r) => r.site === site && r.day_of_week === dow) ?? null,
    [rows],
  );

  return { rows, loading, getWindows, getRow, refresh: fetchRows };
}

/**
 * Plages du jour et plage de référence pour l'établissement sélectionné.
 * Utilisé par les sélecteurs de créneaux et l'état "commandes fermées".
 */
export function useCurrentServiceWindow() {
  const now = useLiveParisTime();
  const { selectedRestaurant } = useCart();
  const { getWindows, loading } = useOpeningHours();

  const site = restaurantToSite(selectedRestaurant?.id ?? selectedRestaurant?.name);
  const dow = parisDayOfWeek(now);
  const nowMinutes = parisMinutes(now);

  const windows = useMemo(() => getWindows(site, dow), [getWindows, site, dow]);

  const reference = useMemo(
    () => referenceWindow(windows, nowMinutes) ?? DEFAULT_WINDOW,
    [windows, nowMinutes],
  );

  const active = useMemo(
    () => windows.find((w) => nowMinutes >= w.start && nowMinutes < w.end) ?? null,
    [windows, nowMinutes],
  );

  return { now, nowMinutes, site, dow, windows, reference, active, loading, getWindows };
}
