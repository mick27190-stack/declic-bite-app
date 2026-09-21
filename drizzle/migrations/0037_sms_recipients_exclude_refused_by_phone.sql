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
  ),
  refused_phones AS (
    SELECT DISTINCT right(regexp_replace(p.phone, '\D', '', 'g'), 9) AS ph
    FROM latest l
    JOIN public.profiles p ON p.user_id = l.client_id
    WHERE l.accepte = false
      AND p.phone IS NOT NULL
      AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 9
    UNION
    SELECT DISTINCT right(regexp_replace(cu2.phone, '\D', '', 'g'), 9)
    FROM latest l2
    JOIN public.customers cu2 ON cu2.user_id = l2.client_id
    WHERE l2.accepte = false
      AND cu2.phone IS NOT NULL
      AND length(regexp_replace(cu2.phone, '\D', '', 'g')) >= 9
  )
  SELECT cu.phone, cu.site, cu.id, cu.user_id
  FROM public.customers cu
  LEFT JOIN latest l ON l.client_id = cu.user_id
  WHERE cu.phone IS NOT NULL
    AND btrim(cu.phone) <> ''
    AND COALESCE(l.accepte, true) = true
    AND right(regexp_replace(cu.phone, '\D', '', 'g'), 9) NOT IN (SELECT ph FROM refused_phones)
    AND NOT EXISTS (
      SELECT 1 FROM public.sms_opt_outs o
      WHERE right(regexp_replace(o.phone, '\D', '', 'g'), 9) = right(regexp_replace(cu.phone, '\D', '', 'g'), 9)
    )
    AND (
      _sites IS NULL
      OR array_length(_sites, 1) IS NULL
      OR cu.site IS NULL
      OR cu.site = ANY(_sites)
    )
$function$;