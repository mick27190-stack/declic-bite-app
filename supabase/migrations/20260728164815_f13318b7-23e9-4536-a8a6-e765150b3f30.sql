-- Source unique de vérité pour le prix unitaire de chaque ligne de commande.
CREATE OR REPLACE FUNCTION public.compute_order_line_prices(_items jsonb, _now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  v_base_price numeric;
  v_size_extra numeric;
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
    v_base_price := COALESCE(NULLIF(it->'pizza'->>'basePrice','')::numeric, 0);
    v_size_extra := COALESCE(NULLIF(it->'size'->>'price','')::numeric, 0);
    promo_price := NULL;
    promo_type_val := NULL;

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
        -- Le prix unitaire affiché reste le prix de référence ; la remise à la
        -- paire est appliquée au niveau du panier complet.
        unit_price := raw_size_price;
      ELSIF promo_price IS NOT NULL THEN
        unit_price := promo_price;
      ELSIF v_size_id = 'senior' AND dow = 2 AND NOT is_holiday THEN
        unit_price := 10;
      ELSE
        unit_price := raw_size_price;
      END IF;

    ELSIF v_category = 'paninis' THEN
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
      unit_price := v_base_price + v_size_extra;
    END IF;

    supp_total := 0;
    IF jsonb_typeof(COALESCE(it->'supplements','[]'::jsonb)) = 'array' THEN
      FOR sup IN SELECT * FROM jsonb_array_elements(it->'supplements') LOOP
        supp_total := supp_total + COALESCE(NULLIF(sup->>'price','')::numeric, 0);
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

GRANT EXECUTE ON FUNCTION public.compute_order_line_prices(jsonb, timestamptz) TO anon, authenticated, service_role;

-- Le total de commande dérive désormais de la même source de vérité.
CREATE OR REPLACE FUNCTION public.compute_order_total(_items jsonb, _now timestamp with time zone DEFAULT now())
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lines jsonb;
  ln jsonb;
  total numeric := 0;
  pair_qty jsonb := '{}'::jsonb;
  pair_ref jsonb := '{}'::jsonb;
  pair_key text;
  pair_rec record;
  agg_qty int;
  agg_ref numeric;
  agg_type text;
  pairs int;
  singles int;
BEGIN
  lines := public.compute_order_line_prices(_items, _now);

  FOR ln IN SELECT * FROM jsonb_array_elements(lines)
  LOOP
    IF COALESCE(ln->>'promo_type','') IN ('second_half','bogo') THEN
      pair_key := COALESCE(ln->>'size_id','') || '|' || (ln->>'promo_type');
      pair_qty := jsonb_set(
        pair_qty,
        ARRAY[pair_key],
        to_jsonb(COALESCE((pair_qty->>pair_key)::int, 0) + (ln->>'quantity')::int),
        true
      );
      pair_ref := jsonb_set(pair_ref, ARRAY[pair_key], to_jsonb((ln->>'unit_price')::numeric), true);
      -- Seuls les suppléments sont comptés ici ; la base passe par le regroupement.
      total := total + (ln->>'supplements_total')::numeric * (ln->>'quantity')::int;
    ELSE
      total := total + (ln->>'line_total')::numeric;
    END IF;
  END LOOP;

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