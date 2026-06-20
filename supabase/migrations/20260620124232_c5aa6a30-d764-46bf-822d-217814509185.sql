ALTER TABLE public.admin_phones DROP CONSTRAINT IF EXISTS admin_phones_phone_key;
ALTER TABLE public.admin_phones ADD CONSTRAINT admin_phones_phone_role_key UNIQUE (phone, role);