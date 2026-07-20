import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyInfo {
  id: string;
  site: 'conches' | 'beaumont';
  name: string | null;
  siret: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

const SITES: Array<CompanyInfo['site']> = ['conches', 'beaumont'];

export function useCompanyInfo() {
  const [data, setData] = useState<Record<string, CompanyInfo | null>>({
    conches: null,
    beaumont: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data: rows } = await supabase.from('company_info' as any).select('*');
    const map: Record<string, CompanyInfo | null> = { conches: null, beaumont: null };
    (rows || []).forEach((r: any) => { map[r.site] = r; });
    setData(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('company_info_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_info' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const upsert = async (site: CompanyInfo['site'], patch: Partial<CompanyInfo>) => {
    const payload = { site, ...patch };
    const { error } = await supabase
      .from('company_info' as any)
      .upsert(payload, { onConflict: 'site' });
    if (error) throw error;
    await fetchAll();
  };

  return { data, loading, upsert, sites: SITES, refresh: fetchAll };
}

export function resolveCompanyForRestaurant(
  data: Record<string, CompanyInfo | null>,
  restaurant?: string | null
): CompanyInfo | null {
  if (!restaurant) return null;
  const r = restaurant.toLowerCase();
  if (r.includes('beaumont')) return data.beaumont;
  return data.conches;
}
