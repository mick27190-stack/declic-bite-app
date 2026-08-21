
ALTER TABLE public.order_history ADD COLUMN IF NOT EXISTS site text;
ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_week_start_key;

DO $$
DECLARE
  r record;
  s text;
  v_orders jsonb;
BEGIN
  FOR r IN SELECT * FROM public.order_history WHERE site IS NULL LOOP
    FOREACH s IN ARRAY ARRAY['conches','beaumont'] LOOP
      SELECT COALESCE(jsonb_agg(e ORDER BY e->>'created_at'), '[]'::jsonb)
      INTO v_orders
      FROM jsonb_array_elements(r.orders) e
      WHERE CASE WHEN lower(COALESCE(e->>'restaurant','')) LIKE '%beaumont%' THEN 'beaumont' ELSE 'conches' END = s;

      IF jsonb_array_length(v_orders) > 0 THEN
        INSERT INTO public.order_history (week_start, week_end, order_count, total_revenue, orders, site, created_at)
        SELECT r.week_start, r.week_end,
               jsonb_array_length(v_orders),
               COALESCE((SELECT sum((e->>'total_price')::numeric) FROM jsonb_array_elements(v_orders) e WHERE COALESCE(e->>'status','') <> 'cancelled'), 0),
               v_orders, s, r.created_at;
      END IF;
    END LOOP;
    DELETE FROM public.order_history WHERE id = r.id;
  END LOOP;
END $$;

UPDATE public.order_history SET site = 'conches' WHERE site IS NULL;
ALTER TABLE public.order_history ALTER COLUMN site SET NOT NULL;
ALTER TABLE public.order_history DROP CONSTRAINT IF EXISTS order_history_site_check;
ALTER TABLE public.order_history ADD CONSTRAINT order_history_site_check CHECK (site IN ('conches','beaumont'));
CREATE UNIQUE INDEX IF NOT EXISTS order_history_week_site_key ON public.order_history (week_start, site);

DROP POLICY IF EXISTS "Admins can view order history" ON public.order_history;
DROP POLICY IF EXISTS "Admins can update order history" ON public.order_history;
DROP POLICY IF EXISTS "Admins can delete order history" ON public.order_history;

CREATE POLICY "Admins can view order history for their site"
ON public.order_history FOR SELECT TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update order history for their site"
ON public.order_history FOR UPDATE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site))
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete order history for their site"
ON public.order_history FOR DELETE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE OR REPLACE FUNCTION public.archive_previous_week_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    count(*),
    COALESCE(sum(o.total_price) FILTER (WHERE o.status::text <> 'cancelled'), 0),
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
$function$;
