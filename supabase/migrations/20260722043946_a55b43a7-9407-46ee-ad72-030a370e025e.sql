CREATE OR REPLACE FUNCTION public.sync_customer_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.customers SET email = NEW.email WHERE user_id = NEW.user_id;
  END IF;
  IF NEW.preferred_restaurant IS DISTINCT FROM OLD.preferred_restaurant
     AND NEW.preferred_restaurant IS NOT NULL THEN
    UPDATE public.customers SET site = NEW.preferred_restaurant WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: customers with no site but a preferred_restaurant on their profile
UPDATE public.customers c
SET site = p.preferred_restaurant
FROM public.profiles p
WHERE p.user_id = c.user_id
  AND p.preferred_restaurant IS NOT NULL
  AND (c.site IS NULL OR c.site <> p.preferred_restaurant);