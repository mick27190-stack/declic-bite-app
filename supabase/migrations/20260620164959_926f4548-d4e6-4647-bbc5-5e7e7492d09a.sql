-- Avoid duplicate new-order triggers (two triggers were calling notify_new_order).
DROP TRIGGER IF EXISTS on_new_order_notify ON public.orders;

-- New-order notifications go ONLY to the chosen restaurant's admins,
-- never to the customer who placed the order (even if they are also an admin).
CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  IF lower(NEW.restaurant) LIKE '%conches%' THEN
    site_value := 'conches';
  ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
    site_value := 'beaumont';
  ELSE
    site_value := 'conches';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
  SELECT u.user_id,
         'Nouvelle commande',
         'Une nouvelle commande a été reçue (' || NEW.total_price || '€)',
         'new_order',
         NEW.id,
         site_value
  FROM (SELECT DISTINCT user_id FROM public.user_roles) u
  WHERE u.user_id <> NEW.user_id
    AND public.should_receive_site_notification(u.user_id, site_value);

  RETURN NEW;
END;
$function$;