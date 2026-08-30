DROP POLICY IF EXISTS "Admins can insert menu availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "Admins can update menu availability" ON public.menu_item_availability;
DROP POLICY IF EXISTS "Admins can delete menu availability" ON public.menu_item_availability;

CREATE POLICY "Admins can insert menu availability"
ON public.menu_item_availability FOR INSERT TO authenticated
WITH CHECK (public.is_any_admin(auth.uid()) AND public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update menu availability"
ON public.menu_item_availability FOR UPDATE TO authenticated
USING (public.is_any_admin(auth.uid()) AND public.can_admin_access_site(auth.uid(), site))
WITH CHECK (public.is_any_admin(auth.uid()) AND public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete menu availability"
ON public.menu_item_availability FOR DELETE TO authenticated
USING (public.is_any_admin(auth.uid()) AND public.can_admin_access_site(auth.uid(), site));