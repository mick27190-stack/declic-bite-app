CREATE POLICY "Super admins lisent tous les consentements"
ON public.consentements
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));