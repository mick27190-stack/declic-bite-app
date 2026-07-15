REVOKE EXECUTE ON FUNCTION public.sync_customer_from_profile() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.sync_customer_site_from_order() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon;

-- Re-grant to authenticated/service_role so Supabase internal triggers can still call them
GRANT EXECUTE ON FUNCTION public.sync_customer_from_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_customer_site_from_order() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;