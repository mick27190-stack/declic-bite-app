
-- Table for manual restaurant closures/order blocking
CREATE TABLE public.restaurant_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL CHECK (site IN ('conches', 'beaumont', 'all')),
  is_active boolean NOT NULL DEFAULT true,
  reason text NOT NULL DEFAULT 'Nous sommes actuellement fermés.',
  end_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_closures ENABLE ROW LEVEL SECURITY;

-- Admins can manage closures
CREATE POLICY "Admins can view closures"
  ON public.restaurant_closures FOR SELECT
  USING (is_any_admin(auth.uid()));

CREATE POLICY "Admins can insert closures"
  ON public.restaurant_closures FOR INSERT
  WITH CHECK (is_any_admin(auth.uid()));

CREATE POLICY "Admins can update closures"
  ON public.restaurant_closures FOR UPDATE
  USING (is_any_admin(auth.uid()));

CREATE POLICY "Admins can delete closures"
  ON public.restaurant_closures FOR DELETE
  USING (is_any_admin(auth.uid()));

-- Customers can view active closures (read-only)
CREATE POLICY "Anyone can view active closures"
  ON public.restaurant_closures FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_restaurant_closures_updated_at
  BEFORE UPDATE ON public.restaurant_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
