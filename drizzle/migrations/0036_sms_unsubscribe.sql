CREATE TABLE IF NOT EXISTS public.sms_unsubscribe_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  user_id uuid,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

GRANT ALL ON public.sms_unsubscribe_tokens TO service_role;
ALTER TABLE public.sms_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  phone text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sms_opt_outs TO service_role;
GRANT SELECT ON public.sms_opt_outs TO authenticated;
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sms opt outs"
ON public.sms_opt_outs FOR SELECT TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.sms_marketing_recipients_v2(_sites text[] DEFAULT NULL::text[])
 RETURNS TABLE(phone text, site text, customer_id uuid, user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH latest AS (
    SELECT DISTINCT ON (c.client_id) c.client_id, c.accepte
    FROM public.consentements c
    WHERE c.type_consentement = 'sms_marketing'
    ORDER BY c.client_id, c.date_consentement DESC, c.created_at DESC
  )
  SELECT cu.phone, cu.site, cu.id, cu.user_id
  FROM public.customers cu
  LEFT JOIN latest l ON l.client_id = cu.user_id
  WHERE cu.phone IS NOT NULL
    AND btrim(cu.phone) <> ''
    AND COALESCE(l.accepte, true) = true
    AND NOT EXISTS (
      SELECT 1 FROM public.sms_opt_outs o WHERE o.phone = btrim(cu.phone)
    )
    AND (
      _sites IS NULL
      OR array_length(_sites, 1) IS NULL
      OR cu.site IS NULL
      OR cu.site = ANY(_sites)
    )
$function$;

GRANT EXECUTE ON FUNCTION public.sms_marketing_recipients_v2(text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sms_marketing_recipients(_sites text[] DEFAULT NULL::text[])
 RETURNS TABLE(phone text, site text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.phone, r.site FROM public.sms_marketing_recipients_v2(_sites) r
$function$;