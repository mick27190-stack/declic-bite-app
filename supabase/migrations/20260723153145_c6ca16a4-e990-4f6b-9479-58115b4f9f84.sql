ALTER TABLE public.menu_item_availability ADD COLUMN IF NOT EXISTS site text;
UPDATE public.menu_item_availability SET site = 'conches' WHERE site IS NULL;
INSERT INTO public.menu_item_availability (item_key, is_available, updated_at, updated_by, site)
SELECT item_key, is_available, updated_at, updated_by, 'beaumont'
FROM public.menu_item_availability
WHERE site = 'conches'
ON CONFLICT DO NOTHING;
ALTER TABLE public.menu_item_availability ALTER COLUMN site SET NOT NULL;
ALTER TABLE public.menu_item_availability DROP CONSTRAINT IF EXISTS menu_item_availability_pkey;
ALTER TABLE public.menu_item_availability ADD PRIMARY KEY (item_key, site);
ALTER TABLE public.menu_item_availability DROP CONSTRAINT IF EXISTS menu_item_availability_site_chk;
ALTER TABLE public.menu_item_availability ADD CONSTRAINT menu_item_availability_site_chk CHECK (site IN ('conches','beaumont'));