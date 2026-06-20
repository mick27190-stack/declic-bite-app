-- Opening hours: Tue-Sun, 18:00–22:00 (Europe/Paris). Closed Mondays.
CREATE OR REPLACE FUNCTION public.is_pizzeria_open()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/Paris')) <> 1
     AND (now() AT TIME ZONE 'Europe/Paris')::time >= TIME '18:00'
     AND (now() AT TIME ZONE 'Europe/Paris')::time <  TIME '22:00';
$$;

-- Decides whether a given admin user should receive a notification for a site.
CREATE OR REPLACE FUNCTION public.should_receive_site_notification(_user_id uuid, _site text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH r AS (
    SELECT array_agg(role) AS roles
    FROM public.user_roles
    WHERE user_id = _user_id
  )
  SELECT
    CASE
      -- Direct site admin / secondary admin of this site.
      WHEN ('site_admin_' || _site)::app_role = ANY(roles) THEN true
      WHEN ('secondary_admin_' || _site)::app_role = ANY(roles) THEN true
      -- Secondary super admin who is ALSO a site admin: during opening hours,
      -- restrict to the site they administer only.
      WHEN 'secondary_super_admin'::app_role = ANY(roles)
           AND public.is_pizzeria_open()
           AND (roles && ARRAY['site_admin_conches','site_admin_beaumont']::app_role[])
        THEN ('site_admin_' || _site)::app_role = ANY(roles)
      -- Secondary super admin otherwise: both sites (like the primary super admin).
      WHEN 'secondary_super_admin'::app_role = ANY(roles) THEN true
      -- Primary super admin: always both sites.
      WHEN 'super_admin'::app_role = ANY(roles) THEN true
      ELSE false
    END
  FROM r;
$$;

REVOKE EXECUTE ON FUNCTION public.is_pizzeria_open() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.should_receive_site_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- Recreate order notification routing.
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
  WHERE public.should_receive_site_notification(u.user_id, site_value);

  RETURN NEW;
END;
$function$;

-- Recreate chat notification routing.
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
    SELECT u.user_id,
           'Nouveau message',
           LEFT(NEW.content, 100),
           'new_message',
           NEW.conversation_id,
           NEW.site
    FROM (SELECT DISTINCT user_id FROM public.user_roles) u
    WHERE public.should_receive_site_notification(u.user_id, NEW.site);
  END IF;
  RETURN NEW;
END;
$function$;