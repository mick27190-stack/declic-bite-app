import { supabase } from '@/integrations/supabase/client';

// Bound each request while retaining every archived week, including cancellations.
export async function fetchOrderHistoryRows() {
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('order_history_readable')
      .select('*')
      .order('week_start', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}