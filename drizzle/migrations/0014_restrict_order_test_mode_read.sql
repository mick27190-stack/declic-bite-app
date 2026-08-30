DROP POLICY IF EXISTS "Anyone can read order test mode" ON public.order_test_mode;

CREATE POLICY "Admins can read order test mode"
ON public.order_test_mode
FOR SELECT
TO authenticated
USING (public.is_any_admin(auth.uid()));

REVOKE SELECT ON public.order_test_mode FROM anon;
GRANT SELECT ON public.order_test_mode TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_order_test_mode_active() TO anon, authenticated;