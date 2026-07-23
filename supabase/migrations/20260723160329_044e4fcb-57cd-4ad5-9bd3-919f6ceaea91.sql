
ALTER TABLE public.pizza_day_promos
  ADD COLUMN IF NOT EXISTS specific_date date;

ALTER TABLE public.pizza_day_promos
  DROP CONSTRAINT IF EXISTS pizza_day_promos_recurrence_check;
ALTER TABLE public.pizza_day_promos
  ADD CONSTRAINT pizza_day_promos_recurrence_check
  CHECK (recurrence IN ('weekly','monthly','once'));

ALTER TABLE public.pizza_day_promos
  DROP CONSTRAINT IF EXISTS pizza_day_promos_week_of_month_check;
ALTER TABLE public.pizza_day_promos
  ADD CONSTRAINT pizza_day_promos_week_of_month_check
  CHECK (
    (recurrence = 'weekly'  AND week_of_month IS NULL AND specific_date IS NULL)
    OR (recurrence = 'monthly' AND week_of_month IN (1,2,3,4,-1) AND specific_date IS NULL)
    OR (recurrence = 'once'    AND week_of_month IS NULL AND specific_date IS NOT NULL)
  );

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
  supp_total numeric;
  raw_size_price numeric;
  promo_price numeric;
  paris_ts timestamp := (_now AT TIME ZONE 'Europe/Paris');
  paris_month int := EXTRACT(MONTH FROM paris_ts)::int;
  paris_day   int := EXTRACT(DAY FROM paris_ts)::int;
  paris_date  date := paris_ts::date;
  dow int := EXTRACT(DOW FROM paris_ts)::int;
  nth_of_month int := ((paris_day - 1) / 7) + 1;
  is_last_of_month boolean := (paris_day + 7) > EXTRACT(DAY FROM (date_trunc('month', paris_ts) + interval '1 month - 1 day'))::int;
  is_holiday boolean;
  pizza_cats text[] := ARRAY['classiques','speciales','vegetariennes','gourmandes'];
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

      SELECT price INTO promo_price
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

      IF promo_price IS NOT NULL THEN
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

    total := total + (base_total + supp_total) * qty;
  END LOOP;

  RETURN ROUND(total::numeric, 2);
END;
$function$;
