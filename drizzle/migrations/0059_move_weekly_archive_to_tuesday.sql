CREATE OR REPLACE FUNCTION public.archive_previous_week_orders_guarded()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'Europe/Paris');
BEGIN
  IF EXTRACT(DOW FROM v_now) = 2 AND EXTRACT(HOUR FROM v_now) = 3 THEN
    PERFORM public.archive_previous_week_orders();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_previous_week_orders_guarded()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'Europe/Paris');
BEGIN
  IF EXTRACT(DOW FROM v_now) = 2 AND EXTRACT(HOUR FROM v_now) = 4 THEN
    PERFORM public.purge_previous_week_orders();
  END IF;
END;
$$;

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'archive-weekly-orders'), schedule := '0 1,2 * * 2');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'purge-weekly-orders'), schedule := '0 2,3 * * 2');