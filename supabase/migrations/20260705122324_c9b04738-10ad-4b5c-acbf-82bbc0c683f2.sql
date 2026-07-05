REVOKE ALL ON FUNCTION public.enforce_order_creation_open() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_site_manually_closed(text) FROM PUBLIC, anon, authenticated;