REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM anon;

DROP POLICY "Admins can view all orders" ON public.orders;
DROP POLICY "Admins can update orders" ON public.orders;
DROP POLICY "Users can view their own orders" ON public.orders;
DROP POLICY "Users can insert their own orders" ON public.orders;

CREATE POLICY "Admins can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (is_any_admin(auth.uid()));

CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (is_any_admin(auth.uid()));

CREATE POLICY "Users can view their own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);