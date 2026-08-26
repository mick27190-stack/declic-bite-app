CREATE OR REPLACE FUNCTION public.sms_marketing_recipients(_sites text[] DEFAULT NULL)
RETURNS TABLE(phone text, site text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (c.client_id) c.client_id, c.accepte
    FROM public.consentements c
    WHERE c.type_consentement = 'sms_marketing'
    ORDER BY c.client_id, c.date_consentement DESC, c.created_at DESC
  )
  SELECT cu.phone, cu.site
  FROM public.customers cu
  LEFT JOIN latest l ON l.client_id = cu.user_id
  WHERE cu.phone IS NOT NULL
    AND btrim(cu.phone) <> ''
    AND COALESCE(l.accepte, true) = true
    AND (
      _sites IS NULL
      OR array_length(_sites, 1) IS NULL
      OR cu.site IS NULL
      OR cu.site = ANY(_sites)
    )
$$;

REVOKE ALL ON FUNCTION public.sms_marketing_recipients(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_marketing_recipients(text[]) TO service_role;