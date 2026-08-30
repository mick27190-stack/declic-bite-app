CREATE OR REPLACE FUNCTION public.archive_previous_week_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start date;
  v_week_end date;
BEGIN
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'Europe/Paris')) - interval '7 days')::date;
  v_week_end := v_week_start + 6;

  INSERT INTO public.order_history (week_start, week_end, order_count, total_revenue, orders, site)
  SELECT
    v_week_start,
    v_week_end,
    count(*) FILTER (WHERE o.status::text IN ('confirmed','preparing','ready','delivered')),
    COALESCE(sum(o.total_price) FILTER (WHERE o.status::text IN ('confirmed','preparing','ready','delivered')), 0),
    COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at), '[]'::jsonb),
    CASE WHEN lower(COALESCE(o.restaurant,'')) LIKE '%beaumont%' THEN 'beaumont' ELSE 'conches' END
  FROM public.orders o
  WHERE (o.created_at AT TIME ZONE 'Europe/Paris')::date BETWEEN v_week_start AND v_week_end
  GROUP BY 6
  ON CONFLICT (week_start, site) DO UPDATE
    SET order_count = EXCLUDED.order_count,
        total_revenue = EXCLUDED.total_revenue,
        orders = EXCLUDED.orders,
        week_end = EXCLUDED.week_end;
END;
$$;