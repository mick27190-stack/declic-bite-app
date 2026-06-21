-- Replace the site notification routing function with a category-aware version.
DROP FUNCTION IF EXISTS public.should_receive_site_notification(uuid, text);

CREATE OR REPLACE FUNCTION public.should_receive_site_notification(_user_id uuid, _site text, _category text DEFAULT 'order')
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT array_agg(role) AS roles
    FROM public.user_roles
    WHERE user_id = _user_id
  )
  SELECT
    CASE
      -- Primary super admin: never receives administration push notifications.
      WHEN 'super_admin'::app_role = ANY(roles) THEN false

      -- Secondary super admin.
      WHEN 'secondary_super_admin'::app_role = ANY(roles) THEN
        CASE
          -- Also a site admin / secondary admin of THIS site.
          WHEN ('site_admin_' || _site)::app_role = ANY(roles)
            OR ('secondary_admin_' || _site)::app_role = ANY(roles) THEN
            CASE
              WHEN public.is_pizzeria_open() THEN true              -- during hours: everything for their site
              ELSE _category = 'chat'                               -- outside hours: chat only
            END
          ELSE
            -- Secondary super admin not tied to this specific site.
            CASE
              WHEN public.is_pizzeria_open() THEN false             -- during hours: leave it to the site admins
              ELSE _category = 'chat'                               -- outside hours: handles client chat
            END
        END

      -- Site admin / secondary admin of this site: only during opening hours.
      WHEN ('site_admin_' || _site)::app_role = ANY(roles)
        OR ('secondary_admin_' || _site)::app_role = ANY(roles) THEN
        public.is_pizzeria_open()

      ELSE false
    END
  FROM r;
$function$;

-- Update callers to pass the proper notification category.

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
    AND public.should_receive_site_notification(u.user_id, site_value, 'order');

  RETURN NEW;
END;
$function$;

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
    WHERE public.should_receive_site_notification(u.user_id, NEW.site, 'chat');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_delivery_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
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

    IF NEW.delivery_response = 'refused' AND NEW.status <> 'cancelled'::order_status THEN
      NEW.status := 'cancelled'::order_status;
    END IF;

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
    WHERE public.should_receive_site_notification(u.user_id, site_value, 'delivery');
  END IF;
  RETURN NEW;
END;
$function$;