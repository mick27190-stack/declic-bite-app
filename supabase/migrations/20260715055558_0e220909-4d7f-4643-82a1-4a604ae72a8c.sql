CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
  body_text text;
  type_label text;
BEGIN
  site_value := public.restaurant_to_site(NEW.restaurant);

  IF NEW.order_type = 'livraison' THEN
    type_label := '🚗 Livraison';
  ELSE
    type_label := '🏪 À emporter';
  END IF;

  body_text := type_label || ' • ' || NEW.total_price || '€';

  IF NEW.order_type = 'livraison' AND NEW.pickup_time IS NOT NULL AND NEW.pickup_time <> '' THEN
    body_text := body_text || ' • Souhaitée à ' || NEW.pickup_time;
  ELSIF NEW.order_type = 'emporter' AND NEW.pickup_time IS NOT NULL AND NEW.pickup_time <> '' THEN
    body_text := body_text || ' • Retrait à ' || NEW.pickup_time;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
  SELECT u.user_id,
         'Nouvelle commande',
         body_text,
         'new_order',
         NEW.id,
         site_value,
         'new_order:' || NEW.id::text || ':' || u.user_id::text
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

  RETURN NEW;
END;
$function$;