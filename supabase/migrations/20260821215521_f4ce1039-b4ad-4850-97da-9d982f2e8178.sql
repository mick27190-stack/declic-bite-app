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
  base_quarter int;
  DELIVERY_FIRST constant int := 18 * 60 + 45;
  DELIVERY_LAST  constant int := 22 * 60;
  DELIVERY_LEAD  constant int := 45;
  DELIVERY_GRACE constant int := 8;
  DELIVERY_CUTOFF constant int := 21 * 60 + 17;
  TAKEAWAY_CUTOFF constant int := 21 * 60 + 31;
  TAKEAWAY_FIRST  constant int := 18 * 60 + 45;
  TAKEAWAY_LAST   constant int := 21 * 60 + 30;
  TAKEAWAY_LEAD   constant int := 15;
  TAKEAWAY_LATE_WINDOW_START constant int := 21 * 60 + 15;
BEGIN
  IF _order_type = 'emporter' THEN
    IF _paris_minutes >= TAKEAWAY_CUTOFF THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées après 21h30.';
    END IF;

    IF _pickup_time IS NOT NULL AND _pickup_time <> '' THEN
      IF _pickup_time !~ '^\d{2}:\d{2}$' THEN
        RAISE EXCEPTION 'Créneau à emporter invalide.';
      END IF;

      slot_hour := split_part(_pickup_time, ':', 1)::int;
      slot_min  := split_part(_pickup_time, ':', 2)::int;
      slot_minutes := slot_hour * 60 + slot_min;

      IF slot_minutes < TAKEAWAY_FIRST
         OR slot_minutes > TAKEAWAY_LAST
         OR (slot_minutes % 15) <> 0 THEN
        RAISE EXCEPTION 'Créneau à emporter invalide. Choisissez un créneau entre 18h45 et 21h30.';
      END IF;

      IF _paris_minutes >= TAKEAWAY_LATE_WINDOW_START THEN
        IF slot_minutes <> TAKEAWAY_LAST THEN
          RAISE EXCEPTION 'Ce créneau à emporter n''est plus disponible. Merci d''en choisir un autre.';
        END IF;
      ELSE
        earliest_allowed := CEIL((_paris_minutes + TAKEAWAY_LEAD)::numeric / 15) * 15;
        IF slot_minutes < GREATEST(earliest_allowed, TAKEAWAY_FIRST) THEN
          RAISE EXCEPTION 'Ce créneau à emporter n''est plus disponible. Merci d''en choisir un autre.';
        END IF;
      END IF;
    END IF;
  END IF;

  IF _order_type = 'livraison' THEN
    IF _paris_minutes >= DELIVERY_CUTOFF THEN
      RAISE EXCEPTION 'Les commandes en livraison ne sont plus acceptées après 21h16.';
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
      RAISE EXCEPTION 'Créneau de livraison invalide. Choisissez un créneau entre 18h45 et 22h00.';
    END IF;

    base_quarter := (_paris_minutes / 15) * 15;
    IF (_paris_minutes - base_quarter) > DELIVERY_GRACE THEN
      base_quarter := base_quarter + 15;
    END IF;
    earliest_allowed := LEAST(GREATEST(base_quarter + DELIVERY_LEAD, DELIVERY_FIRST), DELIVERY_LAST);

    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;
END;
$$;