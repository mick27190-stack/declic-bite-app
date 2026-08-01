CREATE OR REPLACE FUNCTION public.active_site_closure_type(_restaurant text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT c.closure_type
  FROM public.restaurant_closures c
  WHERE c.is_active = true
    AND (c.end_at IS NULL OR c.end_at > now())
    AND (c.site = 'all' OR c.site = public.restaurant_to_site(_restaurant))
  ORDER BY CASE WHEN c.closure_type = 'site' THEN 0 ELSE 1 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paris_now timestamp;
  paris_minutes int;
  closure_kind text;
BEGIN
  -- La fermeture / le blocage s'applique à tout le monde, y compris aux
  -- requêtes qui contournent l'interface (API directe, script, etc.).
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