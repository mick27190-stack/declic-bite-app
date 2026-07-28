ALTER TABLE public.menu_item_overrides
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS base_price numeric;