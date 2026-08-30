
-- 1) Table de référence serveur pour les prix des suppléments
CREATE TABLE public.supplement_prices (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplement_prices TO anon, authenticated;
GRANT ALL ON public.supplement_prices TO service_role;

ALTER TABLE public.supplement_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique des suppléments"
  ON public.supplement_prices FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.supplement_prices (id, name, price) VALUES
  ('jambon', 'Jambon', 1),
  ('champignons', 'Champignons', 1),
  ('oeuf', 'Œuf', 1),
  ('merguez', 'Merguez', 1),
  ('chevre', 'Chèvre', 1),
  ('camembert', 'Camembert', 1),
  ('lardons', 'Lardons', 1),
  ('oignons', 'Oignons', 1),
  ('poivrons', 'Poivrons', 1),
  ('olives', 'Olives', 1);

-- 2) Durcissement du calcul de prix : rejet des articles/tailles/suppléments inconnus
CREATE OR REPLACE FUNCTION public.compute_order_line_prices(_items jsonb, _now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  sup jsonb;
  idx int := 0;
  result jsonb := '[]'::jsonb;
  v_pizza_id text;
  v_category text;
  v_size_id text;
  v_supp_id text;
  v_supp_price numeric;
  qty int;
  unit_price numeric;
  supp_total numeric;
  raw_size_price numeric;
  promo_price numeric;
  promo_type_val text;
  paris_ts timestamp := (_now AT TIME ZONE 'Europe/Paris');
  paris_month int := EXTRACT(MONTH FROM (_now AT TIME ZONE 'Europe/Paris'))::int;
  paris_day   int := EXTRACT(DAY FROM (_now AT TIME ZONE 'Europe/Paris'))::int;
  paris_date  date := (_now AT TIME ZONE 'Europe/Paris')::date;
  dow int := EXTRACT(DOW FROM (_now AT TIME ZONE 'Europe/Paris'))::int;
  nth_of_month int;
  is_last_of_month boolean;
  is_holiday boolean;
  pizza_cats text[] := ARRAY['classiques','speciales','vegetariennes','gourmandes'];
  known_sizes text[] := ARRAY['senior','mega','super-mega'];
BEGIN
  nth_of_month := ((paris_day - 1) / 7) + 1;
  is_last_of_month := (paris_day + 7) > EXTRACT(DAY FROM (date_trunc('month', paris_ts) + interval '1 month - 1 day'))::int;
  is_holiday := (paris_month, paris_day) IN ((5,1),(5,8),(7,14),(8,15),(11,1),(11,11));

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN result;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_pizza_id  := it->'pizza'->>'id';
    v_category  := it->'pizza'->>'category';
    v_size_id   := it->'size'->>'id';
    qty         := COALESCE(NULLIF(it->>'quantity','')::int, 1);
    promo_price := NULL;
    promo_type_val := NULL;

    -- Garde-fou quantité : jamais négative ni absurde
    IF qty < 1 OR qty > 99 THEN
      RAISE EXCEPTION 'Quantité invalide (%) pour l''article %', qty, v_pizza_id;
    END IF;

    IF v_category = ANY(pizza_cats) THEN
      -- Taille obligatoire et connue : le prix vient UNIQUEMENT du serveur
      SELECT price INTO raw_size_price FROM public.pizza_size_prices WHERE size_id = v_size_id;
      IF raw_size_price IS NULL THEN
        IF v_size_id = ANY(known_sizes) THEN
          raw_size_price := CASE v_size_id
            WHEN 'senior'     THEN 13.5
            WHEN 'mega'       THEN 20
            WHEN 'super-mega' THEN 28
          END;
        ELSE
          RAISE EXCEPTION 'Taille inconnue (%) pour une pizza', v_size_id;
        END IF;
      END IF;

      SELECT price, promo_type INTO promo_price, promo_type_val
        FROM public.pizza_day_promos
        WHERE is_active = true
          AND size_id = v_size_id
          AND (
            (recurrence = 'once' AND specific_date = paris_date)
            OR (recurrence = 'weekly' AND day_of_week = dow)
            OR (recurrence = 'monthly' AND day_of_week = dow AND week_of_month = nth_of_month)
            OR (recurrence = 'monthly' AND day_of_week = dow AND week_of_month = -1 AND is_last_of_month)
          )
        ORDER BY
          CASE recurrence WHEN 'once' THEN 0 WHEN 'monthly' THEN 1 ELSE 2 END
        LIMIT 1;

      IF promo_type_val IN ('second_half','bogo') THEN
        unit_price := raw_size_price;
      ELSIF promo_price IS NOT NULL THEN
        unit_price := promo_price;
      ELSIF v_size_id = 'senior' AND dow = 2 AND NOT is_holiday THEN
        unit_price := 10;
      ELSE
        unit_price := raw_size_price;
      END IF;

    ELSIF v_category = 'paninis' THEN
      IF v_size_id IS NOT NULL AND v_size_id NOT IN ('senior','mega') THEN
        RAISE EXCEPTION 'Taille invalide (%) pour un panini', v_size_id;
      END IF;
      SELECT price INTO unit_price
        FROM public.menu_item_prices
        WHERE item_key = CASE WHEN v_size_id = 'mega' THEN 'panini-double' ELSE 'panini-simple' END;
      unit_price := COALESCE(unit_price, CASE WHEN v_size_id = 'mega' THEN 9 ELSE 6 END);

    ELSIF v_pizza_id = 'bambino' THEN
      SELECT price INTO unit_price FROM public.menu_item_prices WHERE item_key = 'bambino';
      unit_price := COALESCE(unit_price, 7);

    ELSIF v_pizza_id IN ('coca-cola-1-5l','rose-bouteille','bambino-pizza-seule','panini-simple','panini-double') THEN
      SELECT price INTO unit_price FROM public.menu_item_prices WHERE item_key = v_pizza_id;
      unit_price := COALESCE(unit_price, 0);

    ELSE
      -- Article personnalisé : prix obligatoirement issu de la base (jamais du client)
      SELECT base_price INTO unit_price
        FROM public.menu_item_overrides
        WHERE item_id = v_pizza_id AND is_custom = true;
      IF unit_price IS NULL THEN
        RAISE EXCEPTION 'Article inconnu ou non autorisé: %', v_pizza_id;
      END IF;
    END IF;

    -- Suppléments : prix résolus côté serveur, identifiants inconnus rejetés
    supp_total := 0;
    IF jsonb_typeof(COALESCE(it->'supplements','[]'::jsonb)) = 'array' THEN
      FOR sup IN SELECT * FROM jsonb_array_elements(it->'supplements') LOOP
        v_supp_id := sup->>'id';
        SELECT price INTO v_supp_price FROM public.supplement_prices WHERE id = v_supp_id;
        IF v_supp_price IS NULL THEN
          RAISE EXCEPTION 'Supplément inconnu: %', v_supp_id;
        END IF;
        supp_total := supp_total + v_supp_price;
      END LOOP;
    END IF;

    result := result || jsonb_build_object(
      'index', idx,
      'quantity', qty,
      'size_id', v_size_id,
      'unit_price', ROUND(unit_price::numeric, 2),
      'supplements_total', ROUND(supp_total::numeric, 2),
      'line_total', ROUND(((unit_price + supp_total) * qty)::numeric, 2),
      'promo_type', promo_type_val
    );
    idx := idx + 1;
  END LOOP;

  RETURN result;
END;
$function$;
