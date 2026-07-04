REVOKE ALL ON FUNCTION public.sync_admin_phone_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_admin_phone_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.sync_admin_phone_user_role() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_admin_phone_user_role() TO service_role;