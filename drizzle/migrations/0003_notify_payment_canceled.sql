CREATE OR REPLACE FUNCTION public.notify_order_payment_canceled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  IF NEW.capture_status = 'cancelled'
     AND OLD.capture_status IS DISTINCT FROM 'cancelled' THEN

    site_value := COALESCE(NEW.site, public.restaurant_to_site(NEW.restaurant));

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT u.user_id,
           'Autorisation Stripe annulée',
           '⛔ Commande retirée de la file • ' || NEW.total_price || '€',
           'payment_canceled',
           NEW.id,
           site_value,
           'payment_canceled:' || NEW.id::text || ':' || u.user_id::text
    FROM (
      SELECT DISTINCT p.user_id
      FROM public.admin_phones ap
      JOIN public.profiles p
        ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
      WHERE ap.active = true
        AND ap.role IN (
          'super_admin'::app_role,
          'secondary_super_admin'::app_role,
          ('site_admin_' || site_value)::app_role,
          ('secondary_admin_' || site_value)::app_role
        )
    ) u
    WHERE public.should_receive_site_notification(u.user_id, site_value, 'order')
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_order_payment_canceled ON public.orders;

CREATE TRIGGER on_order_payment_canceled
AFTER UPDATE OF capture_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_payment_canceled();