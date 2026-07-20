
ALTER TABLE public.company_info ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Storage policies for company-logos bucket
CREATE POLICY "Admins read company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);

CREATE POLICY "Admins upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);

CREATE POLICY "Admins update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);

CREATE POLICY "Admins delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'secondary_super_admin')
    OR public.has_role(auth.uid(), 'site_admin_conches')
    OR public.has_role(auth.uid(), 'site_admin_beaumont')
  )
);
