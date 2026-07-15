CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, phone, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'email'),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );

  INSERT INTO public.customers (user_id, phone, email, first_name, last_name, source)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.email, NEW.raw_user_meta_data ->> 'email'),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'registration'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_customer_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.customers
    SET email = NEW.email
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_customer_from_profile_trigger
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_profile();

CREATE OR REPLACE FUNCTION public.sync_customer_site_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.customers
  SET site = public.restaurant_to_site(NEW.restaurant)
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_customer_site_from_order_trigger
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_site_from_order();