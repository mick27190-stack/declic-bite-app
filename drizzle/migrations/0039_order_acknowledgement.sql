ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS acquittee_le timestamptz, ADD COLUMN IF NOT EXISTS acquittee_par text;
UPDATE public.orders SET acquittee_le = now(), acquittee_par = 'migration' WHERE acquittee_le IS NULL;
CREATE OR REPLACE FUNCTION public.acknowledge_order(_order_id uuid, _by text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text;
BEGIN
  SELECT restaurant INTO _r FROM public.orders WHERE id = _order_id;
  IF _r IS NULL THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
  IF NOT public.can_admin_access_order(auth.uid(), _r) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.orders SET acquittee_le = now(), acquittee_par = COALESCE(_by, auth.uid()::text)
   WHERE id = _order_id AND acquittee_le IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_order(uuid, text) TO authenticated;