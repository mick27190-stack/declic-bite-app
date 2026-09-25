CREATE OR REPLACE FUNCTION public.site_opening_windows(_restaurant text, _dow int)
RETURNS TABLE(win_start int, win_end int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (SELECT public.restaurant_to_site(_restaurant) AS site),
  row AS (
    SELECT h.* FROM public.site_opening_hours h, s
    WHERE h.site = s.site AND h.day_of_week = _dow
  )
  SELECT w.win_start, w.win_end
  FROM (
    SELECT slot1_start::int AS win_start, slot1_end::int AS win_end FROM row
      WHERE is_closed = false AND slot1_start IS NOT NULL AND slot1_end IS NOT NULL
    UNION ALL
    SELECT slot2_start::int, slot2_end::int FROM row
      WHERE is_closed = false AND slot2_start IS NOT NULL AND slot2_end IS NOT NULL
    UNION ALL
    SELECT 18*60, 22*60 WHERE NOT EXISTS (SELECT 1 FROM row) AND _dow <> 1
  ) w
  WHERE w.win_end > w.win_start
  ORDER BY w.win_start;
$$;

CREATE OR REPLACE FUNCTION public.current_site_window(_restaurant text)
RETURNS TABLE(win_start int, win_end int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH n AS (
    SELECT EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Paris'))::int AS dow,
           EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int * 60
             + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Paris'))::int AS mins
  )
  SELECT w.win_start, w.win_end
  FROM n, public.site_opening_windows(_restaurant, n.dow) w
  WHERE n.mins >= w.win_start AND n.mins < w.win_end
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_site_open(_restaurant text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.current_site_window(_restaurant));
$$;

CREATE OR REPLACE FUNCTION public.is_pizzeria_open()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_site_open('conches') OR public.is_site_open('beaumont');
$$;
