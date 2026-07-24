ALTER TABLE public.restaurant_closures REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_closures;