import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchOrderHistoryRows } from './orderHistory';

const { range, from } = vi.hoisted(() => {
  const range = vi.fn();
  const query = { select: vi.fn(), order: vi.fn(), range };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return { range, from: vi.fn(() => query) };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));

describe('archived history loading', () => {
  beforeEach(() => { range.mockReset(); from.mockClear(); });

  it('reads lightweight archives and retains cancelled orders and invoice references', async () => {
    const row = { id: 'week', orders: [{ id: 'cancelled-order', status: 'cancelled', invoice_number: 'CON-2026-001' }] };
    range.mockResolvedValue({ data: [row], error: null });
    expect(await fetchOrderHistoryRows()).toEqual([row]);
    expect(from).toHaveBeenCalledWith('order_history_readable');
  });

  it('loads older pages rather than truncating the history', async () => {
    const firstPage = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }));
    range.mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ id: 'older-week' }], error: null });
    const result = await fetchOrderHistoryRows();
    expect(result).toHaveLength(101);
    expect(result[100]).toEqual({ id: 'older-week' });
    expect(range.mock.calls).toEqual([[0, 99], [100, 199]]);
  });

  it('reports a failed request instead of treating it as empty history', async () => {
    range.mockResolvedValue({ data: null, error: { code: '57014', message: 'timeout' } });
    await expect(fetchOrderHistoryRows()).rejects.toEqual({ code: '57014', message: 'timeout' });
  });
});