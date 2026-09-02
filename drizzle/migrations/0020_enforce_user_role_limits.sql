CREATE OR REPLACE FUNCTION public.enforce_user_role_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cnt int;
BEGIN
  IF NEW.role = 'super_admin'::app_role THEN
    SELECT count(*) INTO cnt
    FROM public.user_roles
    WHERE role = 'super_admin'::app_role
      AND user_id <> NEW.user_id;
    IF cnt >= 1 THEN
      RAISE EXCEPTION 'Il ne peut y avoir qu''un seul Super Admin';
    END IF;
  ELSIF NEW.role = 'secondary_super_admin'::app_role THEN
    SELECT count(*) INTO cnt
    FROM public.user_roles
    WHERE role = 'secondary_super_admin'::app_role
      AND user_id <> NEW.user_id;
    IF cnt >= 2 THEN
      RAISE EXCEPTION 'On ne peut définir que 2 Super Admin secondaires';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_user_role_limits_trigger ON public.user_roles;
CREATE TRIGGER enforce_user_role_limits_trigger
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_limits();