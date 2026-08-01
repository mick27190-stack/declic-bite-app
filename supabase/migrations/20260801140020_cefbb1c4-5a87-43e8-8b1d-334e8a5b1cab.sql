ALTER TABLE public.restaurant_closures ADD COLUMN IF NOT EXISTS closure_type text NOT NULL DEFAULT 'orders';
ALTER TABLE public.restaurant_closures DROP CONSTRAINT IF EXISTS restaurant_closures_closure_type_check;
ALTER TABLE public.restaurant_closures ADD CONSTRAINT restaurant_closures_closure_type_check CHECK (closure_type IN ('orders','site'));