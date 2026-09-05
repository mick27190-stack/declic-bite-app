CREATE TABLE IF NOT EXISTS public.invoice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  site text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_requests_order_unique UNIQUE (order_id)
);

GRANT SELECT ON public.invoice_requests TO authenticated;
GRANT ALL ON public.invoice_requests TO service_role;

ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or site admin can read invoice requests" ON public.invoice_requests;
CREATE POLICY "Owner or site admin can read invoice requests"
ON public.invoice_requests
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_admin_access_site(auth.uid(), site)
);

CREATE OR REPLACE FUNCTION public.request_invoice(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  o record;
  site_value text;
  paris_hour int;
  customer_name text;
  body_text text;
  inserted boolean := false;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  site_value := public.restaurant_to_site(o.restaurant);

  INSERT INTO public.invoice_requests (order_id, user_id, site)
  VALUES (_order_id, auth.uid(), site_value)
  ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF NOT inserted THEN
    RETURN jsonb_build_object('status', 'already_requested');
  END IF;

  SELECT trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    INTO customer_name
  FROM public.profiles p
  WHERE p.user_id = o.user_id
  LIMIT 1;

  IF customer_name IS NULL OR customer_name = '' THEN
    customer_name = 'Client';
  END IF;

  paris_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/Paris'))::int;
  body_text := 'Commande #' || substr(_order_id::text, 1, 8) || ' - ' || customer_name;

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
  SELECT u.user_id,
         'Demande de facture',
         body_text,
         'invoice_request',
         _order_id,
         site_value,
         'invoice_request:' || _order_id::text || ':' || u.user_id::text
  FROM (
    SELECT DISTINCT p.user_id
    FROM public.admin_phones ap
    JOIN public.profiles p
      ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
    WHERE ap.active = true
      AND (
        CASE WHEN paris_hour >= 18 AND paris_hour < 22
          THEN ap.role IN (
            ('site_admin_' || site_value)::app_role,
            ('secondary_admin_' || site_value)::app_role
          )
          ELSE ap.role = 'secondary_super_admin'::app_role
        END
      )
  ) u
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN jsonb_build_object('status', 'sent');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_invoice(uuid) TO authenticated;
