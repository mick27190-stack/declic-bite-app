CREATE TABLE public.menu_item_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key text NOT NULL UNIQUE,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.menu_item_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_prices TO authenticated;
GRANT ALL ON public.menu_item_prices TO service_role;

ALTER TABLE public.menu_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view item prices"
  ON public.menu_item_prices FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage item prices"
  ON public.menu_item_prices FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE TRIGGER update_menu_item_prices_updated_at
  BEFORE UPDATE ON public.menu_item_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_item_prices;

INSERT INTO public.menu_item_prices (item_key, price) VALUES
  ('coca-cola-1-5l', 3),
  ('rose-bouteille', 7),
  ('bambino', 7),
  ('panini-simple', 6),
  ('panini-double', 9);