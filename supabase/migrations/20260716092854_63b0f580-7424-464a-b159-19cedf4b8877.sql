
-- 1) Column
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address text;

-- 2) Helper: format the address to display in the customers file
CREATE OR REPLACE FUNCTION public.format_address_line(
  _street text, _postal_code text, _city text
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT nullif(
    trim(both ' ,' from
      coalesce(_street, '') ||
      CASE WHEN coalesce(_postal_code, '') = '' AND coalesce(_city, '') = ''
           THEN ''
           ELSE ', ' ||
                trim(both ' ' from coalesce(_postal_code, '') || ' ' || coalesce(_city, ''))
      END
    ),
    ''
  )
$$;

-- 3) Resolver: pick the best address for a user (default first, else latest)
CREATE OR REPLACE FUNCTION public.resolve_customer_address(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.format_address_line(a.street, a.postal_code, a.city)
  FROM public.addresses a
  WHERE a.user_id = _user_id
  ORDER BY a.is_default DESC, a.created_at DESC
  LIMIT 1
$$;

-- 4) Trigger fn: keep customers.address in sync when addresses change
CREATE OR REPLACE FUNCTION public.sync_customer_address_from_addresses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.customers
     SET address = public.resolve_customer_address(target_user_id)
   WHERE user_id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_address_ai ON public.addresses;
DROP TRIGGER IF EXISTS sync_customer_address_au ON public.addresses;
DROP TRIGGER IF EXISTS sync_customer_address_ad ON public.addresses;

CREATE TRIGGER sync_customer_address_ai
AFTER INSERT ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_address_from_addresses();

CREATE TRIGGER sync_customer_address_au
AFTER UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_address_from_addresses();

CREATE TRIGGER sync_customer_address_ad
AFTER DELETE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_address_from_addresses();

-- 5) Backfill existing rows
UPDATE public.customers c
   SET address = public.resolve_customer_address(c.user_id)
 WHERE c.user_id IS NOT NULL;
