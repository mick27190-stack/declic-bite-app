ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_capture_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_capture_status_check
  CHECK (capture_status IS NULL OR capture_status = ANY (ARRAY['pending','authorized','captured','cancelled','canceled']));