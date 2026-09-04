-- ============================================================
-- Carte de fidélité virtuelle
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.loyalty_category AS ENUM ('senior', 'mega', 'super_mega');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.loyalty_reward_type AS ENUM ('free_pizza', 'discount_amount');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- loyalty_programs ----------
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site text NOT NULL,
  category public.loyalty_category NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  required_count integer NOT NULL DEFAULT 10,
  reward_type public.loyalty_reward_type NOT NULL DEFAULT 'free_pizza',
  discount_amount numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_programs_site_check CHECK (site IN ('conches','beaumont')),
  CONSTRAINT loyalty_programs_required_count_check CHECK (required_count BETWEEN 1 AND 999),
  CONSTRAINT loyalty_programs_unique_site_category UNIQUE (site, category)
);

GRANT SELECT ON public.loyalty_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_programs_read_all" ON public.loyalty_programs
  FOR SELECT USING (true);
CREATE POLICY "loyalty_programs_super_admin_insert" ON public.loyalty_programs
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "loyalty_programs_super_admin_update" ON public.loyalty_programs
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "loyalty_programs_super_admin_delete" ON public.loyalty_programs
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_loyalty_programs_updated_at
  BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- customer_loyalty_progress ----------
CREATE TABLE IF NOT EXISTS public.customer_loyalty_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  current_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_loyalty_progress_unique UNIQUE (customer_id, program_id),
  CONSTRAINT customer_loyalty_progress_count_check CHECK (current_count >= 0)
);

GRANT SELECT ON public.customer_loyalty_progress TO authenticated;
GRANT ALL ON public.customer_loyalty_progress TO service_role;

ALTER TABLE public.customer_loyalty_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clp_own_read" ON public.customer_loyalty_progress
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_clp_updated_at
  BEFORE UPDATE ON public.customer_loyalty_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- loyalty_rewards_pending ----------
CREATE TABLE IF NOT EXISTS public.loyalty_rewards_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  applied_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT loyalty_rewards_status_check CHECK (status IN ('pending','applied','cancelled'))
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_pending_lookup
  ON public.loyalty_rewards_pending (customer_id, program_id, status);

GRANT SELECT, UPDATE ON public.loyalty_rewards_pending TO authenticated;
GRANT ALL ON public.loyalty_rewards_pending TO service_role;

ALTER TABLE public.loyalty_rewards_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lrp_own_read" ON public.loyalty_rewards_pending
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "lrp_super_admin_update" ON public.loyalty_rewards_pending
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- orders.loyalty_discount ----------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS loyalty_discount jsonb;

-- ============================================================
-- Moteur de fidélité
-- ============================================================

CREATE OR REPLACE FUNCTION public.loyalty_size_to_category(_size_id text)
RETURNS public.loyalty_category
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _size_id
    WHEN 'senior' THEN 'senior'::public.loyalty_category
    WHEN 'mega' THEN 'mega'::public.loyalty_category
    WHEN 'super-mega' THEN 'super_mega'::public.loyalty_category
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.loyalty_program_is_active(
  _enabled boolean, _start date, _end date, _now timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(_enabled, false)
     AND (_start IS NULL OR (_now AT TIME ZONE 'Europe/Paris')::date >= _start)
     AND (_end   IS NULL OR (_now AT TIME ZONE 'Europe/Paris')::date <= _end)
$$;

-- Coeur du moteur : simule (_commit = false) ou applique (_commit = true)
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
  counters jsonb := '{}'::jsonb;   -- program_id -> compteur courant
  pendings jsonb := '{}'::jsonb;   -- program_id -> nb de récompenses pending
  reward_id uuid;
  pizza_cats text[] := ARRAY['classiques','speciales','vegetariennes','gourmandes'];
  key text;
  progs jsonb := '{}'::jsonb;      -- program_id -> config
BEGIN
  IF _user_id IS NULL OR _site IS NULL OR _items IS NULL
     OR jsonb_typeof(_items) <> 'array' THEN
    RETURN jsonb_build_object('total_discount', 0, 'items', '[]'::jsonb);
  END IF;

  -- Programmes actifs du site
  FOR prog IN
    SELECT p.* FROM public.loyalty_programs p
    WHERE p.site = _site
      AND public.loyalty_program_is_active(p.enabled, p.start_date, p.end_date, _now)
  LOOP
    progs := jsonb_set(progs, ARRAY[prog.id::text], jsonb_build_object(
      'category', prog.category::text,
      'required_count', prog.required_count,
      'reward_type', prog.reward_type::text,
      'discount_amount', COALESCE(prog.discount_amount, 0)
    ), true);
    counters := jsonb_set(counters, ARRAY[prog.id::text], to_jsonb(
      COALESCE((SELECT current_count FROM public.customer_loyalty_progress
                WHERE customer_id = _user_id AND program_id = prog.id), 0)
    ), true);
    pendings := jsonb_set(pendings, ARRAY[prog.id::text], to_jsonb(
      (SELECT count(*) FROM public.loyalty_rewards_pending
        WHERE customer_id = _user_id AND program_id = prog.id AND status = 'pending')::int
    ), true);
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

    -- Programme correspondant à cette catégorie
    key := NULL;
    SELECT k INTO key FROM jsonb_object_keys(progs) AS t(k)
      WHERE progs->k->>'category' = cat::text LIMIT 1;
    CONTINUE WHEN key IS NULL;

    unit_base := COALESCE((ln->>'unit_price')::numeric, 0);

    FOR u IN 1..qty LOOP
      IF COALESCE((pendings->>key)::int, 0) > 0 THEN
        -- Consommation d'une récompense
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
      ELSE
        -- Incrémentation du compteur
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

GRANT EXECUTE ON FUNCTION public.compute_loyalty_discount(uuid, text, jsonb, timestamptz, boolean, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.compute_loyalty_discount(uuid, text, jsonb, timestamptz, boolean, uuid) FROM anon, authenticated, PUBLIC;

-- Aperçu client (jamais de commit, toujours pour l'utilisateur connecté)
CREATE OR REPLACE FUNCTION public.preview_loyalty_discount(_site text, _items jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.compute_loyalty_discount(auth.uid(), _site, _items, now(), false, NULL)
$$;

GRANT EXECUTE ON FUNCTION public.preview_loyalty_discount(text, jsonb) TO authenticated, service_role;

-- Total de commande incluant la remise fidélité
CREATE OR REPLACE FUNCTION public.enforce_order_total_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base numeric;
  loyalty jsonb;
BEGIN
  base := public.compute_order_total(NEW.items, COALESCE(NEW.created_at, now()));
  loyalty := public.compute_loyalty_discount(
    NEW.user_id, NEW.site, NEW.items, COALESCE(NEW.created_at, now()), false, NEW.id
  );
  IF COALESCE((loyalty->>'total_discount')::numeric, 0) > 0 THEN
    NEW.loyalty_discount := loyalty;
    base := GREATEST(base - (loyalty->>'total_discount')::numeric, 0);
  ELSE
    NEW.loyalty_discount := NULL;
  END IF;
  NEW.total_price := ROUND(base::numeric, 2);
  RETURN NEW;
END;
$$;

-- Validation définitive des compteurs à l'autorisation du paiement
CREATE OR REPLACE FUNCTION public.apply_loyalty_on_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  loyalty jsonb;
BEGIN
  IF COALESCE(NEW.loyalty_discount->>'committed', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  loyalty := public.compute_loyalty_discount(
    NEW.user_id, NEW.site, NEW.items, COALESCE(NEW.created_at, now()), true, NEW.id
  );

  IF COALESCE((loyalty->>'total_discount')::numeric, 0) > 0 THEN
    UPDATE public.orders
      SET loyalty_discount = loyalty || jsonb_build_object('committed', true)
      WHERE id = NEW.id;
  ELSE
    UPDATE public.orders
      SET loyalty_discount = jsonb_build_object('total_discount', 0, 'items', '[]'::jsonb, 'committed', true)
      WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_loyalty_on_insert ON public.orders;
CREATE TRIGGER trg_apply_loyalty_on_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.capture_status IN ('authorized','captured'))
  EXECUTE FUNCTION public.apply_loyalty_on_authorization();

DROP TRIGGER IF EXISTS trg_apply_loyalty_on_authorization ON public.orders;
CREATE TRIGGER trg_apply_loyalty_on_authorization
  AFTER UPDATE OF capture_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.capture_status IN ('authorized','captured')
        AND (OLD.capture_status IS NULL OR OLD.capture_status NOT IN ('authorized','captured')))
  EXECUTE FUNCTION public.apply_loyalty_on_authorization();

-- Programmes par défaut (désactivés) pour les deux sites
INSERT INTO public.loyalty_programs (site, category, enabled, required_count, reward_type)
SELECT s, c, false, 10, 'free_pizza'::public.loyalty_reward_type
FROM unnest(ARRAY['conches','beaumont']) AS s,
     unnest(ARRAY['senior','mega','super_mega']::public.loyalty_category[]) AS c
ON CONFLICT (site, category) DO NOTHING;