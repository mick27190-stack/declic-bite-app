ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.admin_phones REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_phones;