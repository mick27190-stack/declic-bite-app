CREATE OR REPLACE FUNCTION public.compute_order_total(_items jsonb, _now timestamp with time zone DEFAULT now())
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  sup jsonb;
  total numeric := 0;
  v_pizza_id text;
  v_category text;
  v_size_id text;
  v_base_price numeric;
  v_size_extra numeric;
  qty int;
  base_total numeric;
  line_base_total numeric;
  supp_total numeric;
  raw_size_price numeric;
  promo_price numeric;
  promo_type_val text;
  paris_ts timestamp := (_now AT TIME ZONE 'Europe/Paris');
  paris_month int := EXTRACT(MONTH FROM paris_ts)::int;
  paris_day   int := EXTRACT(DAY FROM paris_ts)::int;
  paris_date  date := paris_ts::date;
  dow int := EXTRACT(DOW FROM paris_ts)::int;
  nth_of_month int := ((paris_day - 1) / 7) + 1;
  is_last_of_month boolean := (paris_day + 7) > EXTRACT(DAY FROM (date_trunc('month', paris_ts) + interval '1 month - 1 day'))::int;
  is_holiday boolean;
  pizza_cats text[] := ARRAY['classiques','speciales','vegetariennes','gourmandes'];
  pairs int;
  singles int;
  -- Regroupement inter-lignes pour les promos à paires
  pair_qty jsonb := '{}'::jsonb;   -- key = size_id|promo_type -> total qty
  pair_ref jsonb := '{}'::jsonb;   -- key -> prix de référence
  pair_key text;
  pair_rec record;
  agg_qty int;
  agg_ref numeric;
  agg_type text;
BEGIN
  is_holiday := (paris_month, paris_day) IN ((5,1),(5,8),(7,14),(8,15),(11,1),(11,11));

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_pizza_id  := it->'pizza'->>'id';
    v_category  := it->'pizza'->>'category';
    v_size_id   := it->'size'->>'id';
    qty         := COALESCE(NULLIF(it->>'quantity','')::int, 1);
    v_base_price := COALESCE(NULLIF(it->'pizza'->>'basePrice','')::numeric, 0);
    v_size_extra := COALESCE(NULLIF(it->'size'->>'price','')::numeric, 0);
    promo_price := NULL;
    promo_type_val := NULL;
    line_base_total := NULL;

    IF v_category = ANY(pizza_cats) THEN
      SELECT price INTO raw_size_price FROM public.pizza_size_prices WHERE size_id = v_size_id;
      IF raw_size_price IS NULL THEN
        raw_size_price := CASE v_size_id
          WHEN 'senior'     THEN 13.5
          WHEN 'mega'       THEN 20
          WHEN 'super-mega' THEN 28
          ELSE 0
        END;
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
        -- On accumule les quantités pour appliquer la remise sur l'ensemble
        -- du panier (regroupement par taille + type de promo).
        pair_key := v_size_id || '|' || promo_type_val;
        pair_qty := jsonb_set(
          pair_qty,
          ARRAY[pair_key],
          to_jsonb(COALESCE((pair_qty->>pair_key)::int, 0) + qty),
          true
        );
        pair_ref := jsonb_set(pair_ref, ARRAY[pair_key], to_jsonb(raw_size_price), true);
        base_total := raw_size_price; -- base pour suppléments (par unité)
      ELSIF promo_price IS NOT NULL THEN
        base_total := promo_price;
      ELSIF v_size_id = 'senior' AND dow = 2 AND NOT is_holiday THEN
        base_total := 10;
      ELSE
        base_total := raw_size_price;
      END IF;

    ELSIF v_category = 'paninis' THEN
      SELECT price INTO base_total
        FROM public.menu_item_prices
        WHERE item_key = CASE WHEN v_size_id = 'mega' THEN 'panini-double' ELSE 'panini-simple' END;
      base_total := COALESCE(base_total, CASE WHEN v_size_id = 'mega' THEN 9 ELSE 6 END);

    ELSIF v_pizza_id = 'bambino' THEN
      SELECT price INTO base_total FROM public.menu_item_prices WHERE item_key = 'bambino';
      base_total := COALESCE(base_total, 7);

    ELSIF v_pizza_id IN ('coca-cola-1-5l','rose-bouteille','bambino-pizza-seule','panini-simple','panini-double') THEN
      SELECT price INTO base_total FROM public.menu_item_prices WHERE item_key = v_pizza_id;
      base_total := COALESCE(base_total, 0);

    ELSE
      base_total := v_base_price + v_size_extra;
    END IF;

    supp_total := 0;
    IF jsonb_typeof(COALESCE(it->'supplements','[]'::jsonb)) = 'array' THEN
      FOR sup IN SELECT * FROM jsonb_array_elements(it->'supplements') LOOP
        supp_total := supp_total + COALESCE(NULLIF(sup->>'price','')::numeric, 0);
      END LOOP;
    END IF;

    -- Pour les lignes en promo à paire, la base sera comptée dans le
    -- regroupement final. On n'ajoute ici que les suppléments (multipliés
    -- par la quantité, comme pour toute autre ligne).
    IF promo_type_val IN ('second_half','bogo') THEN
      total := total + supp_total * qty;
    ELSE
      total := total + (base_total + supp_total) * qty;
    END IF;
  END LOOP;

  -- Application de la remise par paires sur les quantités agrégées.
  FOR pair_rec IN SELECT key FROM jsonb_object_keys(pair_qty) AS t(key)
  LOOP
    agg_qty := (pair_qty->>pair_rec.key)::int;
    agg_ref := (pair_ref->>pair_rec.key)::numeric;
    agg_type := split_part(pair_rec.key, '|', 2);
    pairs := agg_qty / 2;
    singles := agg_qty % 2;
    IF agg_type = 'second_half' THEN
      total := total + pairs * (agg_ref + agg_ref / 2.0) + singles * agg_ref;
    ELSIF agg_type = 'bogo' THEN
      total := total + (pairs + singles) * agg_ref;
    END IF;
  END LOOP;

  RETURN ROUND(total::numeric, 2);
END;
$function$;