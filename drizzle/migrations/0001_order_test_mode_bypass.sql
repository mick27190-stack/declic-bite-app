-- Mode test : permet aux super admins d'ouvrir temporairement la création de
-- commandes en dehors des horaires (18h-22h) pour valider le flux de paiement.
CREATE TABLE IF NOT EXISTS public.order_test_mode (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active_until timestamptz,
  enabled_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_test_mode TO anon;
GRANT SELECT, INSERT, UPDATE ON public.order_test_mode TO authenticated;
GRANT ALL ON public.order_test_mode TO service_role;

ALTER TABLE public.order_test_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read order test mode" ON public.order_test_mode;
CREATE POLICY "Anyone can read order test mode"
  ON public.order_test_mode FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admins can insert order test mode" ON public.order_test_mode;
CREATE POLICY "Super admins can insert order test mode"
  ON public.order_test_mode FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update order test mode" ON public.order_test_mode;
CREATE POLICY "Super admins can update order test mode"
  ON public.order_test_mode FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.order_test_mode (id, active_until)
VALUES (true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Le mode test est actif uniquement tant que active_until est dans le futur :
-- il s'éteint tout seul, aucune ouverture permanente possible par oubli.
CREATE OR REPLACE FUNCTION public.is_order_test_mode_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT active_until > now() FROM public.order_test_mode WHERE id), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_order_test_mode_active() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_order_creation_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  paris_now timestamp;
  paris_minutes int;
  closure_kind text;
BEGIN
  -- La fermeture / le blocage s'applique à tout le monde, y compris aux
  -- requêtes qui contournent l'interface (API directe, script, etc.).
  closure_kind := public.active_site_closure_type(NEW.restaurant);
  IF closure_kind IS NOT NULL THEN
    IF closure_kind = 'site' THEN
      RAISE EXCEPTION 'Ce site est actuellement fermé. Aucune commande ne peut être enregistrée.';
    ELSE
      RAISE EXCEPTION 'Les commandes sont actuellement bloquées pour ce site.';
    END IF;
  END IF;

  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Mode test temporaire activé par un super admin : les contrôles d'horaires
  -- et de cut-off sont suspendus, les blocages de site restent appliqués.
  IF public.is_order_test_mode_active() THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_pizzeria_open() THEN
    RAISE EXCEPTION 'La pizzeria est fermée. Commandes possibles uniquement du mardi au dimanche, de 18h à 22h.';
  END IF;

  paris_now := (now() AT TIME ZONE 'Europe/Paris');
  paris_minutes := EXTRACT(HOUR FROM paris_now)::int * 60
                 + EXTRACT(MINUTE FROM paris_now)::int;

  PERFORM public.check_order_creation_cutoff(NEW.order_type::text, NEW.pickup_time, paris_minutes);

  RETURN NEW;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_test_mode;
