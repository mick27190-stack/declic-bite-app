-- Colonnes de paiement Stripe (additives, nullable / avec défaut)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS order_status text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS capture_status text,
  ADD COLUMN IF NOT EXISTS delivery_time_requested timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_time_proposed timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_time_confirmed timestamptz;

-- Contraintes de valeurs (nullable autorisé pour les commandes historiques)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_site_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_site_check
  CHECK (site IS NULL OR site IN ('conches','beaumont'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IS NULL OR order_status IN (
    'pending_confirmation','awaiting_customer_response','confirmed',
    'cancelled','preparing','delivered'
  ));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_capture_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_capture_status_check
  CHECK (capture_status IS NULL OR capture_status IN ('authorized','captured','cancelled'));

-- Le site est dérivé du restaurant si non fourni
CREATE OR REPLACE FUNCTION public.set_order_site_from_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.site IS NULL THEN
    NEW.site := public.restaurant_to_site(NEW.restaurant);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_order_site_from_restaurant_trg ON public.orders;
CREATE TRIGGER set_order_site_from_restaurant_trg
  BEFORE INSERT OR UPDATE OF restaurant, site ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_site_from_restaurant();

-- Backfill du site pour les commandes existantes
UPDATE public.orders SET site = public.restaurant_to_site(restaurant) WHERE site IS NULL;

CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx
  ON public.orders (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS orders_order_status_site_idx
  ON public.orders (order_status, site);

-- Les colonnes de paiement ne doivent jamais être modifiables par le client ni le livreur :
-- seules les edge functions (service_role, qui contourne RLS et ce trigger via is_any_admin=false
-- mais sans auth.uid()) et les admins peuvent y toucher.
CREATE OR REPLACE FUNCTION public.enforce_order_payment_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- service_role (edge functions) : auth.uid() est NULL -> autorisé
  IF auth.uid() IS NULL OR public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.capture_status IS DISTINCT FROM OLD.capture_status
     OR NEW.order_status IS DISTINCT FROM OLD.order_status
     OR NEW.delivery_time_proposed IS DISTINCT FROM OLD.delivery_time_proposed
     OR NEW.delivery_time_confirmed IS DISTINCT FROM OLD.delivery_time_confirmed
     OR NEW.site IS DISTINCT FROM OLD.site THEN
    RAISE EXCEPTION 'Modification non autorisée des champs de paiement';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_payment_fields_trg ON public.orders;
CREATE TRIGGER enforce_order_payment_fields_trg
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_payment_fields();