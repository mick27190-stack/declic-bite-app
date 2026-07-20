
-- 1) Server-side recomputation of order total_price to prevent client price tampering.
CREATE OR REPLACE FUNCTION public.compute_order_total(_items jsonb, _now timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  dow int := EXTRACT(DOW FROM paris_ts)::int;
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
      -- Pizza pricing driven exclusively by server-side pizza_size_prices +
      -- pizza_day_promos (with Tuesday senior fallback except holidays).
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
        WHERE is_active = true AND day_of_week = dow AND size_id = v_size_id
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
      -- Unknown item: fall back to declared base + size extras. This is the
      -- only path that trusts client-provided pricing, and it only affects
      -- items not registered in menu_item_prices.
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
$$;

REVOKE ALL ON FUNCTION public.compute_order_total(jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_order_total(jsonb, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_order_total_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_price := public.compute_order_total(NEW.items, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_total_price ON public.orders;
CREATE TRIGGER trg_enforce_order_total_price
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_total_price();

-- 2) Storage: site-scoped access for invoices bucket.
--    Files are uploaded under `<site>/...` so we can scope by path prefix.
DROP POLICY IF EXISTS "Admins can read invoices" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload invoices" ON storage.objects;

CREATE POLICY "Admins can read invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins can upload invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins can update invoices"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins can delete invoices"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'invoices'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

-- 3) Storage: site-scoped access for company-logos bucket.
--    Files are already uploaded under `<site>/logo-...`.
DROP POLICY IF EXISTS "Admins read company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete company logos" ON storage.objects;

CREATE POLICY "Admins read company logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins upload company logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins update company logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);

CREATE POLICY "Admins delete company logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (
      split_part(name, '/', 1) IN ('conches','beaumont')
      AND public.can_admin_access_site(auth.uid(), split_part(name, '/', 1))
    )
  )
);
