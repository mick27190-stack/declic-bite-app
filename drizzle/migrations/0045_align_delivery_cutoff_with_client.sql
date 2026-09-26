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
  delivery_last  int := _win_end;
  takeaway_last  int := _win_end - 30;
  delivery_lead  constant int := 45;
  delivery_grace constant int := 8;
  delivery_cutoff int := _win_end - 43;
  takeaway_cutoff int := _win_end - 29;
  quarter int;
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

    -- Même règle que le client : délai de 45 min avec une grâce de 8 min
    -- sur le quart d'heure en cours.
    quarter := (_paris_minutes / 15) * 15;
    earliest_allowed := (CASE WHEN _paris_minutes - quarter <= delivery_grace
                              THEN quarter ELSE quarter + 15 END) + delivery_lead;

    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_order_creation_cutoff_window(text, text, int, int, int)
  TO anon, authenticated, service_role;