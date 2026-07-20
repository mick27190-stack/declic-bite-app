
CREATE TABLE public.menu_item_overrides (
  item_id text PRIMARY KEY,
  name text,
  description text,
  ingredients text[],
  category text,
  capacity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.menu_item_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_overrides TO authenticated;
GRANT ALL ON public.menu_item_overrides TO service_role;

ALTER TABLE public.menu_item_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view menu overrides"
  ON public.menu_item_overrides FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage menu overrides"
  ON public.menu_item_overrides FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE TRIGGER update_menu_item_overrides_updated_at
  BEFORE UPDATE ON public.menu_item_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_overrides;
ALTER TABLE public.menu_item_overrides REPLICA IDENTITY FULL;
