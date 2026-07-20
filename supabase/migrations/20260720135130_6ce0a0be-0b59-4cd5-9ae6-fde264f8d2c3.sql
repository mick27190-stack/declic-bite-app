
CREATE POLICY "Admins can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);

CREATE POLICY "Admins can read invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);
