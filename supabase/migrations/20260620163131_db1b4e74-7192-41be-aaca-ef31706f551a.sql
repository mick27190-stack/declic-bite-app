CREATE OR REPLACE FUNCTION public.notify_delivery_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  -- Only when the customer responds to a delivery proposal (delivery_response changes to a non-null value).
  IF NEW.delivery_response IS NOT NULL
     AND NEW.delivery_response IS DISTINCT FROM OLD.delivery_response
  THEN
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

    -- If the customer refuses, automatically cancel the order.
    IF NEW.delivery_response = 'refused' AND NEW.status <> 'cancelled'::order_status THEN
      NEW.status := 'cancelled'::order_status;
    END IF;

    -- Notify the relevant restaurant admins.
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
    SELECT u.user_id,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Horaire de livraison accepté'
                ELSE 'Horaire de livraison refusé' END,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Le client a accepté l''horaire de livraison proposé pour la commande #' || LEFT(NEW.id::text, 8) || '.'
                ELSE 'Le client a refusé l''horaire de livraison. La commande #' || LEFT(NEW.id::text, 8) || ' a été annulée.' END,
           'new_order',
           NEW.id,
           site_value
    FROM (SELECT DISTINCT user_id FROM public.user_roles) u
    WHERE public.should_receive_site_notification(u.user_id, site_value);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_delivery_response ON public.orders;
CREATE TRIGGER trg_notify_delivery_response
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_delivery_response();