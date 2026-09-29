CREATE OR REPLACE FUNCTION public.notify_delivery_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  site_value text;
BEGIN
  IF NEW.delivery_response IS NOT NULL
     AND NEW.delivery_response IS DISTINCT FROM OLD.delivery_response
  THEN
    site_value := public.restaurant_to_site(NEW.restaurant);

    IF NEW.delivery_response = 'refused' AND NEW.status <> 'cancelled'::order_status THEN
      NEW.status := 'cancelled'::order_status;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT u.user_id,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Horaire de livraison accepté'
                ELSE 'Horaire de livraison refusé' END,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Le client a accepté l''horaire de livraison proposé pour la commande #' || LEFT(NEW.id::text, 8) || '.'
                ELSE 'Le client a refusé l''horaire de livraison. La commande #' || LEFT(NEW.id::text, 8) || ' a été annulée.' END,
           'new_order',
           NEW.id,
           site_value,
           'delivery_resp:' || NEW.id::text || ':' || NEW.delivery_response::text || ':' || u.user_id::text
    FROM (
      SELECT DISTINCT p.user_id
      FROM public.admin_phones ap
      JOIN public.profiles p
        ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
      LEFT JOIN public.admin_notification_prefs prefs ON prefs.user_id = p.user_id
      WHERE ap.active = true
        AND ap.role IN (
          'super_admin'::app_role,
          'secondary_super_admin'::app_role,
          ('site_admin_' || site_value)::app_role,
          ('secondary_admin_' || site_value)::app_role
        )
        AND CASE site_value
          WHEN 'conches' THEN COALESCE(prefs.notify_conches, true)
          WHEN 'beaumont' THEN COALESCE(prefs.notify_beaumont, true)
          ELSE true
        END
    ) u
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;