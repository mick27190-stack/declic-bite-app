CREATE OR REPLACE FUNCTION public.sms_marketing_recipient_count(_sites text[] DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_any_admin(auth.uid())
      THEN (SELECT count(*)::int FROM public.sms_marketing_recipients(_sites))
    ELSE 0
  END
$$;

REVOKE ALL ON FUNCTION public.sms_marketing_recipient_count(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_marketing_recipient_count(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sms_marketing_recipient_count(text[]) TO service_role;