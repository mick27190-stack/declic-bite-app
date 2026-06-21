CREATE SCHEMA IF NOT EXISTS authz;
REVOKE ALL ON SCHEMA authz FROM PUBLIC;
GRANT USAGE ON SCHEMA authz TO authenticated;
GRANT USAGE ON SCHEMA authz TO service_role;

CREATE OR REPLACE FUNCTION authz.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION authz.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT authz.has_role(_user_id, 'super_admin'::public.app_role)
      OR authz.has_role(_user_id, 'secondary_super_admin'::public.app_role)
$function$;

REVOKE ALL ON FUNCTION authz.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION authz.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authz.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION authz.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION authz.is_super_admin(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _user_id OR authz.is_super_admin(auth.uid()) THEN authz.has_role(_user_id, _role)
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _user_id OR authz.is_super_admin(auth.uid()) THEN authz.is_super_admin(_user_id)
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _user_id OR authz.is_super_admin(auth.uid()) THEN
      authz.has_role(_user_id, 'super_admin'::public.app_role)
      OR authz.has_role(_user_id, 'secondary_super_admin'::public.app_role)
      OR authz.has_role(_user_id, 'site_admin_conches'::public.app_role)
      OR authz.has_role(_user_id, 'site_admin_beaumont'::public.app_role)
      OR authz.has_role(_user_id, 'secondary_admin_conches'::public.app_role)
      OR authz.has_role(_user_id, 'secondary_admin_beaumont'::public.app_role)
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_admin_access_site(_user_id uuid, _site text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _user_id OR authz.is_super_admin(auth.uid()) THEN
      authz.is_super_admin(_user_id)
      OR (authz.has_role(_user_id, 'site_admin_conches'::public.app_role) AND _site = 'conches')
      OR (authz.has_role(_user_id, 'secondary_admin_conches'::public.app_role) AND _site = 'conches')
      OR (authz.has_role(_user_id, 'site_admin_beaumont'::public.app_role) AND _site = 'beaumont')
      OR (authz.has_role(_user_id, 'secondary_admin_beaumont'::public.app_role) AND _site = 'beaumont')
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.can_admin_access_order(_user_id uuid, _restaurant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT CASE
    WHEN auth.uid() = _user_id OR authz.is_super_admin(auth.uid()) THEN
      authz.is_super_admin(_user_id)
      OR (authz.has_role(_user_id, 'site_admin_conches'::public.app_role) AND public.restaurant_to_site(_restaurant) = 'conches')
      OR (authz.has_role(_user_id, 'secondary_admin_conches'::public.app_role) AND public.restaurant_to_site(_restaurant) = 'conches')
      OR (authz.has_role(_user_id, 'site_admin_beaumont'::public.app_role) AND public.restaurant_to_site(_restaurant) = 'beaumont')
      OR (authz.has_role(_user_id, 'secondary_admin_beaumont'::public.app_role) AND public.restaurant_to_site(_restaurant) = 'beaumont')
    ELSE false
  END
$function$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'authz'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND (auth.uid() = _user_id OR authz.is_super_admin(auth.uid()))
$function$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_to_site(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_to_site(text) TO service_role;