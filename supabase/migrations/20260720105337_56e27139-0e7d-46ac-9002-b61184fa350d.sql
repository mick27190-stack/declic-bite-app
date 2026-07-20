
CREATE TABLE public.company_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL UNIQUE CHECK (site IN ('conches','beaumont')),
  name text,
  siret text,
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_info TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_info TO authenticated;
GRANT ALL ON public.company_info TO service_role;

ALTER TABLE public.company_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company info"
  ON public.company_info FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert company info for their site"
  ON public.company_info FOR INSERT
  TO authenticated
  WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update company info for their site"
  ON public.company_info FOR UPDATE
  TO authenticated
  USING (public.can_admin_access_site(auth.uid(), site))
  WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete company info for their site"
  ON public.company_info FOR DELETE
  TO authenticated
  USING (public.can_admin_access_site(auth.uid(), site));

CREATE TRIGGER update_company_info_updated_at
  BEFORE UPDATE ON public.company_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.company_info (site) VALUES ('conches'), ('beaumont')
  ON CONFLICT (site) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.company_info;
