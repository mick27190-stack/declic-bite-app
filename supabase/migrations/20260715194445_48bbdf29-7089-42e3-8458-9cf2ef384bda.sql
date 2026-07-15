CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  paris_time time;
  paris_minutes int;
  slot_minutes int;
  slot_hour int;
  slot_min int;
  earliest_allowed int;
  DELIVERY_FIRST constant int := 18 * 60 + 45;
  DELIVERY_LAST  constant int := 21 * 60 + 45;
  DELIVERY_LEAD  constant int := 30;
  DELIVERY_CUTOFF constant int := 21 * 60 + 16;
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

  paris_time := (now() AT TIME ZONE 'Europe/Paris')::time;
  paris_minutes := EXTRACT(HOUR FROM paris_time)::int * 60
                 + EXTRACT(MINUTE FROM paris_time)::int;

  IF NEW.order_type = 'emporter' THEN
    IF paris_time >= TIME '21:31' THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées après 21h30.';
    END IF;
  END IF;

  IF NEW.order_type = 'livraison' THEN
    IF paris_minutes >= DELIVERY_CUTOFF THEN
      RAISE EXCEPTION 'Les commandes en livraison ne sont plus acceptées après 21h15.';
    END IF;

    IF NEW.pickup_time IS NULL OR NEW.pickup_time !~ '^\d{2}:\d{2}$' THEN
      RAISE EXCEPTION 'Merci de choisir un créneau de livraison.';
    END IF;

    slot_hour := split_part(NEW.pickup_time, ':', 1)::int;
    slot_min  := split_part(NEW.pickup_time, ':', 2)::int;
    slot_minutes := slot_hour * 60 + slot_min;

    IF slot_minutes < DELIVERY_FIRST
       OR slot_minutes > DELIVERY_LAST
       OR (slot_minutes % 15) <> 0 THEN
      RAISE EXCEPTION 'Créneau de livraison invalide. Choisissez un créneau entre 18h45 et 21h45.';
    END IF;

    earliest_allowed := CEIL((paris_minutes + DELIVERY_LEAD)::numeric / 15) * 15;

    IF slot_minutes < earliest_allowed THEN
      RAISE EXCEPTION 'Ce créneau de livraison n''est plus disponible. Merci d''en choisir un autre.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;