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
  inserted_count int := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR o.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  site_value := public.restaurant_to_site(o.restaurant);

  INSERT INTO public.invoice_requests (order_id, user_id, site)
  VALUES (_order_id, auth.uid(), site_value)
  ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    RETURN jsonb_build_object('status', 'already_requested');
  END IF;

  SELECT trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    INTO customer_name
  FROM public.profiles p
  WHERE p.user_id = o.user_id
  LIMIT 1;

  IF customer_name IS NULL OR customer_name = '' THEN
    customer_name := 'Client';
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
