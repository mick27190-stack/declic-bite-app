import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_SIZE_PRICES,
  DayPromo,
  setPricingData,
} from '@/lib/pricing';

interface PricingContextValue {
  sizePrices: Record<string, number>;
  dayPromos: DayPromo[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PricingContext = createContext<PricingContextValue>({
  sizePrices: DEFAULT_SIZE_PRICES,
  dayPromos: [],
  loading: true,
  refresh: async () => {},
});

export function PricingProvider({ children }: { children: ReactNode }) {
  const [sizePrices, setSizePrices] = useState<Record<string, number>>(DEFAULT_SIZE_PRICES);
  const [dayPromos, setDayPromos] = useState<DayPromo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sizeRes, promoRes] = await Promise.all([
      supabase.from('pizza_size_prices').select('*'),
      supabase.from('pizza_day_promos').select('*'),
    ]);

    const spMap: Record<string, number> = { ...DEFAULT_SIZE_PRICES };
    (sizeRes.data ?? []).forEach((row: any) => {
      spMap[row.size_id] = Number(row.price);
    });

    const promos: DayPromo[] = (promoRes.data ?? []).map((row: any) => ({
      id: row.id,
      day_of_week: row.day_of_week,
      size_id: row.size_id,
      price: Number(row.price),
      label: row.label,
      is_active: row.is_active,
    }));

    setPricingData(spMap, promos);
    setSizePrices(spMap);
    setDayPromos(promos);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('pricing-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pizza_size_prices' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pizza_day_promos' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <PricingContext.Provider value={{ sizePrices, dayPromos, loading, refresh: load }}>
      {children}
    </PricingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePricing = () => useContext(PricingContext);
