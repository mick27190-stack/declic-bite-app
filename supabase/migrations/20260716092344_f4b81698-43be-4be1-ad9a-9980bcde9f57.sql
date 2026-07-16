
-- Pure, testable cut-off validator. Same rules as enforce_order_creation_open,
-- but the "current Paris minutes" is passed in so tests can pin any boundary.
CREATE OR REPLACE FUNCTION public.check_order_creation_cutoff(
  _order_type text,
  _pickup_time text,
  _paris_minutes int
) RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  slot_minutes int;
  slot_hour int;
  slot_min int;
  earliest_allowed int;
  DELIVERY_FIRST constant int := 18 * 60 + 45;
  DELIVERY_LAST  constant int := 21 * 60 + 45;
  DELIVERY_LEAD  constant int := 30;
  DELIVERY_CUTOFF constant int := 21 * 60 + 16;   -- 21h16
  TAKEAWAY_CUTOFF constant int := 21 * 60 + 31;   -- 21h31 (last valid 21h30)
BEGIN
  IF _order_type = 'emporter' THEN
    IF _paris_minutes >= TAKEAWAY_CUTOFF THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées après 21h30.';
    END IF;
  END IF;

  IF _order_type = 'livraison' THEN
    IF _paris_minutes >= DELIVERY_CUTOFF THEN
      RAISE EXCEPTION 'Les commandes en livraison ne sont plus acceptées après 21h15.';
    END IF;

    IF _pickup_time IS NULL OR _pickup_time !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'Merci de choisir un créneau de livraison.';
    END IF;

    slot_hour := split_part(_pickup_time, ':', 1)::int;
    slot_min  := split_part(_pickup_time, ':', 2)::int;
    slot_minutes := slot_hour * 60 + slot_min;

    IF slot_minutes < DELIVERY_FIRST
       OR slot_minutes > DELIVERY_LAST
       OR (slot_minutes % 15) <> 0 THEN
      RAISE EXCEPTION 'Créneau de livraison invalide. Choisissez un créneau entre 18h45 et 21h45.';
    END IF;

    earliest_allowed := CEIL((_paris_minutes + DELIVERY_LEAD)::numeric / 15) * 15;

    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_order_creation_cutoff(text, text, int)
  TO anon, authenticated, service_role;

-- Refactor the trigger to reuse the pure validator.
CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paris_now timestamp;
  paris_minutes int;
BEGIN
  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.is_site_manually_closed(NEW.restaurant) THEN
    RAISE EXCEPTION 'Les commandes sont actuellement bloquées pour ce site.';
  END IF;

  IF NOT public.is_pizzeria_open() THEN
    RAISE EXCEPTION 'La pizzeria est fermée. Commandes possibles uniquement du mardi au dimanche, de 18h à 22h.';
  END IF;

  paris_now := (now() AT TIME ZONE 'Europe/Paris');
  paris_minutes := EXTRACT(HOUR FROM paris_now)::int * 60
                 + EXTRACT(MINUTE FROM paris_now)::int;

  PERFORM public.check_order_creation_cutoff(NEW.order_type::text, NEW.pickup_time, paris_minutes);

  RETURN NEW;
END;
$$;
