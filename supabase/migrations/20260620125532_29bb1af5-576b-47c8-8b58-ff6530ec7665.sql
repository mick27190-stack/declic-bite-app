CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_any_admin(auth.uid()));