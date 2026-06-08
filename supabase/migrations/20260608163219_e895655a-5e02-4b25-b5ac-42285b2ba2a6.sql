GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO anon, authenticated;