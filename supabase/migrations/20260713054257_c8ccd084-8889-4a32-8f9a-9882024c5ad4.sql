
-- 1. Table
CREATE TABLE public.order_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL UNIQUE,
  week_end date NOT NULL,
  order_count integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_history TO authenticated;
GRANT ALL ON public.order_history TO service_role;

ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order history"
ON public.order_history
FOR SELECT
TO authenticated
USING (public.is_any_admin(auth.uid()));

-- 2. Archive function (idempotent per week)
CREATE OR REPLACE FUNCTION public.archive_previous_week_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_week_start date;
  v_week_end date;
BEGIN
  -- Previous complete week (Monday..Sunday), based on Paris time
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'Europe/Paris')) - interval '7 days')::date;
  v_week_end := v_week_start + 6;

  INSERT INTO public.order_history (week_start, week_end, order_count, total_revenue, orders)
  SELECT
    v_week_start,
    v_week_end,
    count(*),
    COALESCE(sum(o.total_price), 0),
    COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.created_at), '[]'::jsonb)
  FROM public.orders o
  WHERE (o.created_at AT TIME ZONE 'Europe/Paris')::date BETWEEN v_week_start AND v_week_end
  ON CONFLICT (week_start) DO UPDATE
    SET order_count = EXCLUDED.order_count,
        total_revenue = EXCLUDED.total_revenue,
        orders = EXCLUDED.orders;
END;
$$;

-- 3. Guarded wrapper: only actually archive at 3am Paris on Monday
CREATE OR REPLACE FUNCTION public.archive_previous_week_orders_guarded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'Europe/Paris');
BEGIN
  IF EXTRACT(DOW FROM v_now) = 1 AND EXTRACT(HOUR FROM v_now) = 3 THEN
    PERFORM public.archive_previous_week_orders();
  END IF;
END;
$$;

-- 4. Schedule via pg_cron (runs at 01:00 and 02:00 UTC Mondays; guard ensures exactly 3am Paris in both winter/summer)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'archive-weekly-orders',
  '0 1,2 * * 1',
  $cron$ SELECT public.archive_previous_week_orders_guarded(); $cron$
);
