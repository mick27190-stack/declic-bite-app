
CREATE TABLE IF NOT EXISTS public.menu_item_availability (
  item_key text PRIMARY KEY,
  is_available boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.menu_item_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_item_availability TO authenticated;
GRANT ALL ON public.menu_item_availability TO service_role;

ALTER TABLE public.menu_item_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu availability readable by everyone"
  ON public.menu_item_availability FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert menu availability"
  ON public.menu_item_availability FOR INSERT
  TO authenticated
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can update menu availability"
  ON public.menu_item_availability FOR UPDATE
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can delete menu availability"
  ON public.menu_item_availability FOR DELETE
  TO authenticated
  USING (public.is_any_admin(auth.uid()));

CREATE TRIGGER trg_menu_item_availability_updated_at
  BEFORE UPDATE ON public.menu_item_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_availability;
