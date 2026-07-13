CREATE OR REPLACE FUNCTION public.preview_purge_previous_week_orders()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_week_start date;
  v_week_end date;
  v_is_archived boolean;
  v_count integer;
  v_revenue numeric;
BEGIN
  -- Only administrators may run the preview.
  IF NOT public.is_any_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Previous complete week (Monday..Sunday), based on Paris time
  v_week_start := (date_trunc('week', (now() AT TIME ZONE 'Europe/Paris')) - interval '7 days')::date;
  v_week_end := v_week_start + 6;

  SELECT EXISTS (
    SELECT 1 FROM public.order_history WHERE week_start = v_week_start
  ) INTO v_is_archived;

  SELECT count(*), COALESCE(sum(o.total_price), 0)
  INTO v_count, v_revenue
  FROM public.orders o
  WHERE (o.created_at AT TIME ZONE 'Europe/Paris')::date BETWEEN v_week_start AND v_week_end;

  RETURN jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'is_archived', v_is_archived,
    'would_delete_count', v_count,
    'would_delete_revenue', v_revenue,
    'would_run', v_is_archived,
    'dry_run', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_purge_previous_week_orders() FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_purge_previous_week_orders() TO authenticated;