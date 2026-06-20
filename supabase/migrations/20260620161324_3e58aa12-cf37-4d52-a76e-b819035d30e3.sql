CREATE OR REPLACE FUNCTION public.notify_delivery_estimate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  site_value text;
BEGIN
  -- Only when a new (non-null) delivery estimate is proposed and the customer
  -- has not responded yet (delivery_response reset to null).
  IF NEW.order_type = 'livraison'
     AND NEW.delivery_estimate IS NOT NULL
     AND NEW.delivery_estimate IS DISTINCT FROM OLD.delivery_estimate
     AND NEW.delivery_response IS NULL
  THEN
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
    VALUES (
      NEW.user_id,
      'Horaire de livraison proposé',
      'Le restaurant propose une livraison à ' || NEW.delivery_estimate || '. Acceptez ou refusez cet horaire.',
      'new_order',
      NEW.id,
      site_value
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_delivery_estimate ON public.orders;
CREATE TRIGGER trg_notify_delivery_estimate
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_delivery_estimate();