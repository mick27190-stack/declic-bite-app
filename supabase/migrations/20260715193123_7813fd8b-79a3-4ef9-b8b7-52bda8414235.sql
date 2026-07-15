REVOKE EXECUTE ON FUNCTION public.sync_customer_from_profile() FROM authenticated, service_role, sandbox_exec;
REVOKE EXECUTE ON FUNCTION public.sync_customer_site_from_order() FROM authenticated, service_role, sandbox_exec;

-- Garde handle_new_user accessible aux rôles système pour le trigger auth.users
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, service_role, sandbox_exec;