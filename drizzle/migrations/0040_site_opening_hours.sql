-- Horaires d'ouverture paramétrables par site, jusqu'à 2 plages par jour.
CREATE TABLE IF NOT EXISTS public.site_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL CHECK (site IN ('conches','beaumont')),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed boolean NOT NULL DEFAULT false,
  slot1_start smallint,
  slot1_end smallint,
  slot2_start smallint,
  slot2_end smallint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (site, day_of_week)
);

GRANT SELECT ON public.site_opening_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_opening_hours TO authenticated;
GRANT ALL ON public.site_opening_hours TO service_role;

ALTER TABLE public.site_opening_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Opening hours are public" ON public.site_opening_hours;
CREATE POLICY "Opening hours are public"
  ON public.site_opening_hours FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Site admins manage their opening hours" ON public.site_opening_hours;
CREATE POLICY "Site admins manage their opening hours"
  ON public.site_opening_hours FOR ALL
  TO authenticated
  USING (public.can_admin_access_site(auth.uid(), site))
  WITH CHECK (public.can_admin_access_site(auth.uid(), site));

-- Plages d'ouverture d'un site pour un jour donné (minutes depuis minuit).
-- Repli sur 18h-22h du mardi au dimanche si aucune ligne n'est configurée.
CREATE OR REPLACE FUNCTION public.site_opening_windows(_restaurant text, _dow int)
RETURNS TABLE(win_start int, win_end int)
LANGUAGE sql
STABLE
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
    -- repli quand le site n'a aucune configuration enregistrée
    SELECT 18*60, 22*60 WHERE NOT EXISTS (SELECT 1 FROM row) AND _dow <> 1
  ) w
  WHERE w.win_end > w.win_start
  ORDER BY w.win_start;
$$;

-- Plage en cours (heure de Paris) pour un site, NULL si fermé maintenant.
CREATE OR REPLACE FUNCTION public.current_site_window(_restaurant text)
RETURNS TABLE(win_start int, win_end int)
LANGUAGE sql
STABLE
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
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.current_site_window(_restaurant));
$$;

-- Ouvert = au moins un des deux établissements est ouvert.
CREATE OR REPLACE FUNCTION public.is_pizzeria_open()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT public.is_site_open('conches') OR public.is_site_open('beaumont');
$$;

-- Validateur de coupure adossé à la plage horaire en cours.
CREATE OR REPLACE FUNCTION public.check_order_creation_cutoff_window(
  _order_type text,
  _pickup_time text,
  _paris_minutes int,
  _win_start int,
  _win_end int
) RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  slot_minutes int;
  earliest_allowed int;
  delivery_first int := _win_start + 45;
  delivery_last  int := _win_end - 15;
  takeaway_last  int := _win_end - 30;
  delivery_lead  constant int := 30;
  delivery_cutoff int := _win_end - 44;
  takeaway_cutoff int := _win_end - 29;
BEGIN
  IF _order_type = 'emporter' THEN
    IF _paris_minutes >= takeaway_cutoff THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées pour ce service.';
    END IF;
  END IF;

  IF _order_type = 'livraison' THEN
    IF _paris_minutes >= delivery_cutoff THEN
      RAISE EXCEPTION 'Les commandes en livraison ne sont plus acceptées pour ce service.';
    END IF;

    IF _pickup_time IS NULL OR _pickup_time !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'Merci de choisir un créneau de livraison.';
    END IF;

    slot_minutes := split_part(_pickup_time, ':', 1)::int * 60
                  + split_part(_pickup_time, ':', 2)::int;

    IF slot_minutes < delivery_first
       OR slot_minutes > delivery_last
       OR (slot_minutes % 15) <> 0 THEN
      RAISE EXCEPTION 'Créneau de livraison invalide pour les horaires de ce service.';
    END IF;

    earliest_allowed := CEIL((_paris_minutes + delivery_lead)::numeric / 15) * 15;

    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_order_creation_cutoff_window(text, text, int, int, int)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.site_opening_windows(text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_site_window(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_site_open(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paris_minutes int;
  closure_kind text;
  w record;
BEGIN
  closure_kind := public.active_site_closure_type(NEW.restaurant);
  IF closure_kind IS NOT NULL THEN
    IF closure_kind = 'site' THEN
      RAISE EXCEPTION 'Ce site est actuellement fermé. Aucune commande ne peut être enregistrée.';
    ELSE
      RAISE EXCEPTION 'Les commandes sont actuellement bloquées pour ce site.';
    END IF;
  END IF;

  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO w FROM public.current_site_window(NEW.restaurant);
  IF w IS NULL THEN
    RAISE EXCEPTION 'La pizzeria est fermée. Merci de consulter les horaires d''ouverture.';
  END IF;

  paris_minutes := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int * 60
                 + EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Paris'))::int;

  PERFORM public.check_order_creation_cutoff_window(
    NEW.order_type::text, NEW.pickup_time, paris_minutes, w.win_start, w.win_end);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_order_creation_open() FROM PUBLIC, anon, authenticated;
