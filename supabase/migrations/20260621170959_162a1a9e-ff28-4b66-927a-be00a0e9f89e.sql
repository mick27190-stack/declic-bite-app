CREATE OR REPLACE FUNCTION public.should_receive_site_notification(_user_id uuid, _site text, _category text DEFAULT 'order'::text)
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
      -- Person holds the (active) site-admin role for THIS site.
      -- This is checked FIRST so that a super admin who is ALSO an active
      -- site admin of this site still receives that site's notifications.
      WHEN ('site_admin_' || _site)::app_role = ANY(roles)
        OR ('secondary_admin_' || _site)::app_role = ANY(roles) THEN
        CASE
          -- Also a (secondary) super admin: during hours everything for
          -- their site, outside hours chat only.
          WHEN 'super_admin'::app_role = ANY(roles)
            OR 'secondary_super_admin'::app_role = ANY(roles) THEN
            CASE
              WHEN public.is_pizzeria_open() THEN true
              ELSE _category = 'chat'
            END
          -- Pure site admin / secondary admin: only during opening hours.
          ELSE public.is_pizzeria_open()
        END

      -- Pure super admin (no site-admin role): never receives admin push.
      WHEN 'super_admin'::app_role = ANY(roles) THEN false

      -- Secondary super admin not tied to this specific site:
      -- outside hours handles client chat, during hours nothing.
      WHEN 'secondary_super_admin'::app_role = ANY(roles) THEN
        CASE
          WHEN public.is_pizzeria_open() THEN false
          ELSE _category = 'chat'
        END

      ELSE false
    END
  FROM r;
$function$;