GRANT EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_to_site(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;

-- Keep service role access explicit for backend functions and admin operations.
GRANT EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_to_site(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO service_role;