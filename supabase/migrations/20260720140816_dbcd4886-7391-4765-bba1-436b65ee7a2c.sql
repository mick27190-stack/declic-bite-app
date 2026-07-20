
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  total_ttc NUMERIC(10,2) NOT NULL,
  recipient_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  restaurant TEXT NOT NULL,
  site TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resent_count INT NOT NULL DEFAULT 0,
  last_resent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_number)
);

CREATE INDEX idx_invoices_site ON public.invoices(site);
CREATE INDEX idx_invoices_user ON public.invoices(user_id);
CREATE INDEX idx_invoices_sent_at ON public.invoices(sent_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invoices for their site"
ON public.invoices FOR SELECT TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can insert invoices for their site"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can update invoices for their site"
ON public.invoices FOR UPDATE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site))
WITH CHECK (public.can_admin_access_site(auth.uid(), site));

CREATE POLICY "Admins can delete invoices for their site"
ON public.invoices FOR DELETE TO authenticated
USING (public.can_admin_access_site(auth.uid(), site));

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
