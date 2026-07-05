-- Table: prix par taille de pizza (communs aux 2 sites)
CREATE TABLE public.pizza_size_prices (
  size_id text PRIMARY KEY,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pizza_size_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_size_prices TO authenticated;
GRANT ALL ON public.pizza_size_prices TO service_role;

ALTER TABLE public.pizza_size_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pizza size prices"
  ON public.pizza_size_prices FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify pizza size prices"
  ON public.pizza_size_prices FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE TRIGGER update_pizza_size_prices_updated_at
  BEFORE UPDATE ON public.pizza_size_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: promotions par jour de la semaine
CREATE TABLE public.pizza_day_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week int NOT NULL,
  size_id text NOT NULL,
  price numeric NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pizza_day_promos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pizza_day_promos TO authenticated;
GRANT ALL ON public.pizza_day_promos TO service_role;

ALTER TABLE public.pizza_day_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pizza day promos"
  ON public.pizza_day_promos FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify pizza day promos"
  ON public.pizza_day_promos FOR ALL
  TO authenticated
  USING (public.is_any_admin(auth.uid()))
  WITH CHECK (public.is_any_admin(auth.uid()));

CREATE TRIGGER update_pizza_day_promos_updated_at
  BEFORE UPDATE ON public.pizza_day_promos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prix par défaut
INSERT INTO public.pizza_size_prices (size_id, price) VALUES
  ('senior', 13.5),
  ('mega', 20),
  ('super-mega', 28);

-- Temps réel
ALTER PUBLICATION supabase_realtime ADD TABLE public.pizza_size_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pizza_day_promos;