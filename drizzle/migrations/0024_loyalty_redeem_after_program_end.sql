CREATE OR REPLACE FUNCTION public.compute_loyalty_discount(
  _user_id uuid,
  _site text,
  _items jsonb,
  _now timestamptz DEFAULT now(),
  _commit boolean DEFAULT false,
  _order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lines jsonb;
  it jsonb;
  ln jsonb;
  idx int := 0;
  u int;
  qty int;
  v_category text;
  v_size_id text;
  cat public.loyalty_category;
  prog record;
  unit_base numeric;
  discount numeric;
  total_discount numeric := 0;
  details jsonb := '[]'::jsonb;
  counters jsonb := '{}'::jsonb;
  pendings jsonb := '{}'::jsonb;
  reward_id uuid;
  pizza_cats text[] := ARRAY['classiques','speciales','vegetariennes','gourmandes'];
  key text;
  progs jsonb := '{}'::jsonb;
  v_active boolean;
  v_pending int;
BEGIN
  IF _user_id IS NULL OR _site IS NULL OR _items IS NULL
     OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('total_discount', 0, 'items', '[]'::jsonb);
  END IF;

  -- Programmes du site : actifs (gain + consommation) ou inactifs mais avec
  -- des récompenses déjà acquises (consommation seule, même après la fin).
  FOR prog IN
    SELECT p.* FROM public.loyalty_programs p WHERE p.site = _site
  LOOP
    v_active := public.loyalty_program_is_active(prog.enabled, prog.start_date, prog.end_date, _now);
    SELECT count(*)::int INTO v_pending
      FROM public.loyalty_rewards_pending
      WHERE customer_id = _user_id AND program_id = prog.id AND status = 'pending';

    CONTINUE WHEN NOT v_active AND v_pending = 0;

    progs := jsonb_set(progs, ARRAY[prog.id::text], jsonb_build_object(
      'category', prog.category::text,
      'required_count', prog.required_count,
      'reward_type', prog.reward_type::text,
      'discount_amount', COALESCE(prog.discount_amount, 0),
      'active', v_active
    ), true);
    counters := jsonb_set(counters, ARRAY[prog.id::text], to_jsonb(
      COALESCE((SELECT current_count FROM public.customer_loyalty_progress
                WHERE customer_id = _user_id AND program_id = prog.id), 0)
    ), true);
    pendings := jsonb_set(pendings, ARRAY[prog.id::text], to_jsonb(v_pending), true);
  END LOOP;

  IF progs = '{}'::jsonb THEN
    RETURN jsonb_build_object('total_discount', 0, 'items', '[]'::jsonb);
  END IF;

  lines := public.compute_order_line_prices(_items, _now);

  FOR it IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    ln := lines->idx;
    idx := idx + 1;
    v_category := it->'pizza'->>'category';
    v_size_id  := it->'size'->>'id';
    qty := COALESCE(NULLIF(it->>'quantity','')::int, 1);

    CONTINUE WHEN NOT (v_category = ANY(pizza_cats));
    cat := public.loyalty_size_to_category(v_size_id);
    CONTINUE WHEN cat IS NULL;

    key := NULL;
    SELECT k INTO key FROM jsonb_object_keys(progs) AS t(k)
      WHERE progs->k->>'category' = cat::text LIMIT 1;
    CONTINUE WHEN key IS NULL;

    unit_base := COALESCE((ln->>'unit_price')::numeric, 0);

    FOR u IN 1..qty LOOP
      IF COALESCE((pendings->>key)::int, 0) > 0 THEN
        IF progs->key->>'reward_type' = 'free_pizza' THEN
          discount := unit_base;
        ELSE
          discount := LEAST((progs->key->>'discount_amount')::numeric, unit_base);
        END IF;
        discount := ROUND(GREATEST(discount, 0)::numeric, 2);
        total_discount := total_discount + discount;
        pendings := jsonb_set(pendings, ARRAY[key], to_jsonb((pendings->>key)::int - 1), true);

        details := details || jsonb_build_object(
          'program_id', key,
          'category', cat::text,
          'reward_type', progs->key->>'reward_type',
          'amount', discount,
          'item_name', it->'pizza'->>'name',
          'size_id', v_size_id
        );

        IF _commit THEN
          SELECT id INTO reward_id FROM public.loyalty_rewards_pending
            WHERE customer_id = _user_id AND program_id = key::uuid AND status = 'pending'
            ORDER BY created_at LIMIT 1;
          IF reward_id IS NOT NULL THEN
            UPDATE public.loyalty_rewards_pending
              SET status = 'applied', applied_at = now(), applied_order_id = _order_id
              WHERE id = reward_id;
          END IF;
        END IF;
      ELSIF COALESCE((progs->key->>'active')::boolean, false) THEN
        counters := jsonb_set(counters, ARRAY[key], to_jsonb((counters->>key)::int + 1), true);
        IF (counters->>key)::int >= (progs->key->>'required_count')::int THEN
          counters := jsonb_set(counters, ARRAY[key], to_jsonb(0), true);
          pendings := jsonb_set(pendings, ARRAY[key], to_jsonb(COALESCE((pendings->>key)::int, 0) + 1), true);
          IF _commit THEN
            INSERT INTO public.loyalty_rewards_pending (customer_id, program_id, status)
            VALUES (_user_id, key::uuid, 'pending');
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  IF _commit THEN
    FOR key IN SELECT k FROM jsonb_object_keys(progs) AS t(k) LOOP
      CONTINUE WHEN NOT COALESCE((progs->key->>'active')::boolean, false);
      INSERT INTO public.customer_loyalty_progress (customer_id, program_id, current_count)
      VALUES (_user_id, key::uuid, (counters->>key)::int)
      ON CONFLICT (customer_id, program_id)
      DO UPDATE SET current_count = EXCLUDED.current_count, updated_at = now();
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'total_discount', ROUND(total_discount::numeric, 2),
    'items', details
  );
END;
$$;
