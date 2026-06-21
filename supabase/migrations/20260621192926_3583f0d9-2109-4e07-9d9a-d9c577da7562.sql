CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  site_value := public.restaurant_to_site(NEW.restaurant);

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
  SELECT u.user_id,
         'Nouvelle commande',
         'Une nouvelle commande a été reçue (' || NEW.total_price || '€)',
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