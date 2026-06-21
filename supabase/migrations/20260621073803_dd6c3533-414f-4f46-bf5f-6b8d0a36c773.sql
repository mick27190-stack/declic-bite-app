ALTER TABLE public.admin_phones ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Enforce: only one super_admin and at most 2 secondary_super_admin in admin_phones
CREATE OR REPLACE FUNCTION public.enforce_admin_phone_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cnt int;
BEGIN
  IF NEW.role = 'super_admin'::app_role THEN
    SELECT count(*) INTO cnt
    FROM public.admin_phones
    WHERE role = 'super_admin'::app_role
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF cnt >= 1 THEN
      RAISE EXCEPTION 'Il ne peut y avoir qu''un seul Super Admin';
    END IF;
  ELSIF NEW.role = 'secondary_super_admin'::app_role THEN
    SELECT count(*) INTO cnt
    FROM public.admin_phones
    WHERE role = 'secondary_super_admin'::app_role
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF cnt >= 2 THEN
      RAISE EXCEPTION 'On ne peut définir que 2 Super Admin secondaires';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_phone_limits_trigger ON public.admin_phones;
CREATE TRIGGER enforce_admin_phone_limits_trigger
BEFORE INSERT OR UPDATE ON public.admin_phones
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_phone_limits();