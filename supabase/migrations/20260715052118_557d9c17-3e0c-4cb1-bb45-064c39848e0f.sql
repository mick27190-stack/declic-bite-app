CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  paris_time time;
BEGIN
  -- Admins can create orders regardless of opening state.
  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.is_site_manually_closed(NEW.restaurant) THEN
    RAISE EXCEPTION 'Les commandes sont actuellement bloquées pour ce site.';
  END IF;

  IF NOT public.is_pizzeria_open() THEN
    RAISE EXCEPTION 'La pizzeria est fermée. Commandes possibles uniquement du mardi au dimanche, de 18h à 22h.';
  END IF;

  -- Block take-away orders after 21h30 (Paris) so the last valid pickup slot
  -- can still be honoured before the kitchen closes at 22h.
  IF NEW.order_type = 'emporter' THEN
    paris_time := (now() AT TIME ZONE 'Europe/Paris')::time;
    IF paris_time >= TIME '21:31' THEN
      RAISE EXCEPTION 'Les commandes à emporter ne sont plus acceptées après 21h30.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;