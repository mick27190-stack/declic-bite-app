GRANT EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.restaurant_to_site(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_livreur(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_livreur_access_order(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO anon;