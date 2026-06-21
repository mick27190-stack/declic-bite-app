-- Helper: can an admin access data for a given site?
CREATE OR REPLACE FUNCTION public.can_admin_access_site(_user_id uuid, _site text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_super_admin(_user_id)
    OR (public.has_role(_user_id, 'site_admin_conches'::app_role) AND _site = 'conches')
    OR (public.has_role(_user_id, 'secondary_admin_conches'::app_role) AND _site = 'conches')
    OR (public.has_role(_user_id, 'site_admin_beaumont'::app_role) AND _site = 'beaumont')
    OR (public.has_role(_user_id, 'secondary_admin_beaumont'::app_role) AND _site = 'beaumont')
$function$;

-- ===== customers: scope admin access by site =====
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;

CREATE POLICY "Admins can view customers"
ON public.customers FOR SELECT TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site))
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

-- ===== profiles: scope admin access by the user's site membership =====
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view profiles for their site"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.user_id = profiles.user_id
      AND public.can_admin_access_site(auth.uid(), c.site)
  )
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = profiles.user_id
      AND public.can_admin_access_order(auth.uid(), o.restaurant)
  )
);

-- ===== restaurant_closures: scope admin writes by site =====
DROP POLICY IF EXISTS "Admins can insert closures" ON public.restaurant_closures;
DROP POLICY IF EXISTS "Admins can update closures" ON public.restaurant_closures;
DROP POLICY IF EXISTS "Admins can delete closures" ON public.restaurant_closures;

CREATE POLICY "Admins can insert closures"
ON public.restaurant_closures FOR INSERT TO authenticated
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update closures"
ON public.restaurant_closures FOR UPDATE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site))
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete closures"
ON public.restaurant_closures FOR DELETE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

-- ===== realtime admin-presence channel: admins only =====
DROP POLICY IF EXISTS "Authenticated users can use admin presence channel" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can broadcast on admin presence channel" ON realtime.messages;

CREATE POLICY "Admins can use admin presence channel"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.topic() = 'admin-presence' AND public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can broadcast on admin presence channel"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (realtime.topic() = 'admin-presence' AND public.is_any_admin(auth.uid()));