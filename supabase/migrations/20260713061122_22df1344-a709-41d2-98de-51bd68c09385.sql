-- Purge the previous complete week's live orders AFTER they have been archived.
-- Physical rows are removed from public.orders, but the all-time total is
-- preserved via public.order_history (order_count is kept per archived week).

CREATE OR REPLACE FUNCTION public.purge_previous_week_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_week_start date;
  v_week_end date;
  v_is_archived boolean;
BEGIN
  -- Previous complete week (Monday..Sunday), based on Paris time
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'Europe/Paris')) - interval '7 days')::date;
  v_week_end := v_week_start + 6;

  -- Safety: only purge if that week has actually been archived first.
  SELECT EXISTS (
    SELECT 1 FROM public.order_history WHERE week_start = v_week_start
  ) INTO v_is_archived;

  IF NOT v_is_archived THEN
    RAISE WARNING 'purge_previous_week_orders: week % not archived yet, skipping', v_week_start;
    RETURN;
  END IF;

  DELETE FROM public.orders o
  WHERE (o.created_at AT TIME ZONE 'Europe/Paris')::date BETWEEN v_week_start AND v_week_end;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_previous_week_orders_guarded()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'Europe/Paris');
BEGIN
  IF EXTRACT(DOW FROM v_now) = 1 AND EXTRACT(HOUR FROM v_now) = 4 THEN
    PERFORM public.purge_previous_week_orders();
  END IF;
END;
$function$;

-- Schedule at 4:00 Paris time (UTC 2 in summer / UTC 3 in winter); the guard
-- ensures the purge only runs when Paris local hour is exactly 4.
SELECT cron.schedule(
  'purge-weekly-orders',
  '0 2,3 * * 1',
  $$ SELECT public.purge_previous_week_orders_guarded(); $$
);