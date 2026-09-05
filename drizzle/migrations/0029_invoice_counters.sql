CREATE TABLE IF NOT EXISTS public.invoice_counters (
  establishment_id text NOT NULL,
  year int NOT NULL,
  last_number int NOT NULL DEFAULT 0,
  PRIMARY KEY (establishment_id, year)
);

GRANT ALL ON public.invoice_counters TO service_role;

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view invoice counters"
ON public.invoice_counters
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_invoice_number(p_establishment_id text, p_year int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.invoice_counters (establishment_id, year, last_number)
  VALUES (p_establishment_id, p_year, 1)
  ON CONFLICT (establishment_id, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_invoice_number(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.next_invoice_number(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(text, int) TO service_role;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text;