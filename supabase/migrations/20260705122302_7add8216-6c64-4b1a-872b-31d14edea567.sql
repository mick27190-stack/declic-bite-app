-- Helper: is there an active manual closure covering this restaurant's site?
CREATE OR REPLACE FUNCTION public.is_site_manually_closed(_restaurant text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_closures c
    WHERE c.is_active = true
      AND (c.end_at IS NULL OR c.end_at > now())
      AND (c.site = 'all' OR c.site = public.restaurant_to_site(_restaurant))
  )
$$;

-- Enforce closure rules on order creation (backend guard against UI bypass)
CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_creation_open ON public.orders;
CREATE TRIGGER trg_enforce_order_creation_open
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_creation_open();