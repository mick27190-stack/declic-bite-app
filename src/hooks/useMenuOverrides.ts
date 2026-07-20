import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Pizza, ProductCategory } from '@/types/pizza';

export interface MenuOverride {
  item_id: string;
  name: string | null;
  description: string | null;
  ingredients: string[] | null;
  category: string | null;
  capacity: string | null;
}

type OverrideMap = Record<string, MenuOverride>;

let cache: OverrideMap = {};
const listeners = new Set<(m: OverrideMap) => void>();

async function fetchAll() {
  const { data } = await supabase.from('menu_item_overrides').select('*');
  cache = {};
  (data ?? []).forEach((row: any) => {
    cache[row.item_id] = row as MenuOverride;
  });
  listeners.forEach((l) => l(cache));
}

let inited = false;
function initRealtime() {
  if (inited) return;
  inited = true;
  fetchAll();
  supabase
    .channel('menu-overrides')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'menu_item_overrides' },
      () => fetchAll(),
    )
    .subscribe();
}

export function applyOverride(pizza: Pizza, o?: MenuOverride): Pizza {
  if (!o) return pizza;
  const category = (o.category as ProductCategory) ?? pizza.category;
  const isDrink = category === 'boissons';
  const baseName = o.name ?? pizza.name;
  const name = isDrink && o.capacity ? `${baseName} – ${o.capacity}` : baseName;
  return {
    ...pizza,
    name,
    description: isDrink && o.capacity ? o.capacity : (o.description ?? pizza.description),
    ingredients: o.ingredients && o.ingredients.length > 0 ? o.ingredients : pizza.ingredients,
    category,
  };
}

export function useMenuOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>(cache);

  useEffect(() => {
    initRealtime();
    const l = (m: OverrideMap) => setOverrides({ ...m });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const applyToList = useCallback(
    (list: Pizza[]) => list.map((p) => applyOverride(p, overrides[p.id])),
    [overrides],
  );

  const upsert = useCallback(async (payload: Partial<MenuOverride> & { item_id: string }) => {
    const { error } = await supabase
      .from('menu_item_overrides')
      .upsert(payload, { onConflict: 'item_id' });
    if (error) throw error;
  }, []);

  return { overrides, applyToList, applyOverride, upsert };
}
