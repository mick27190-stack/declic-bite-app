
CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  -- Normalize restaurant name to site value
  IF lower(NEW.restaurant) LIKE '%conches%' THEN
    site_value := 'conches';
  ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
    site_value := 'beaumont';
  ELSE
    site_value := 'conches'; -- fallback
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
  SELECT ur.user_id, 
         'Nouvelle commande',
         'Une nouvelle commande a été reçue (' || NEW.total_price || '€)',
         'new_order',
         NEW.id,
         site_value
  FROM public.user_roles ur
  WHERE (
    ur.role = 'super_admin'
    OR (ur.role = 'site_admin_conches' AND site_value = 'conches')
    OR (ur.role = 'site_admin_beaumont' AND site_value = 'beaumont')
    OR (ur.role = 'secondary_admin_conches' AND site_value = 'conches')
    OR (ur.role = 'secondary_admin_beaumont' AND site_value = 'beaumont')
  );
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_new_order_notify ON public.orders;
CREATE TRIGGER on_new_order_notify
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();
