CREATE OR REPLACE FUNCTION public.sync_admin_phone_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected_phone text;
  affected_user_id uuid;
  affected_role public.app_role;
  should_grant boolean;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT p.user_id INTO affected_user_id
    FROM public.profiles p
    WHERE public.normalize_phone(p.phone) = public.normalize_phone(OLD.phone)
    LIMIT 1;

    IF affected_user_id IS NOT NULL THEN
      DELETE FROM public.user_roles
      WHERE user_id = affected_user_id
        AND role = OLD.role;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    affected_phone := NEW.phone;
    affected_role := NEW.role;
    should_grant := COALESCE(NEW.active, false);

    IF should_grant THEN
      SELECT p.user_id INTO affected_user_id
      FROM public.profiles p
      WHERE public.normalize_phone(p.phone) = public.normalize_phone(affected_phone)
      LIMIT 1;

      IF affected_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, assigned_by)
        VALUES (affected_user_id, affected_role, NEW.created_by)
        ON CONFLICT (user_id, role) DO UPDATE
        SET assigned_by = EXCLUDED.assigned_by;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_admin_phone_user_role_trigger ON public.admin_phones;
CREATE TRIGGER sync_admin_phone_user_role_trigger
AFTER INSERT OR UPDATE OF phone, role, active OR DELETE ON public.admin_phones
FOR EACH ROW
EXECUTE FUNCTION public.sync_admin_phone_user_role();

GRANT EXECUTE ON FUNCTION public.sync_admin_phone_user_role() TO service_role;

-- Backfill current active admin/livreur rows so existing badges match the admin settings now.
DELETE FROM public.user_roles ur
WHERE ur.role IN (
  'super_admin'::public.app_role,
  'secondary_super_admin'::public.app_role,
  'site_admin_conches'::public.app_role,
  'site_admin_beaumont'::public.app_role,
  'secondary_admin_conches'::public.app_role,
  'secondary_admin_beaumont'::public.app_role,
  'livreur_conches'::public.app_role,
  'livreur_beaumont'::public.app_role
)
AND NOT EXISTS (
  SELECT 1
  FROM public.admin_phones ap
  JOIN public.profiles p
    ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
  WHERE p.user_id = ur.user_id
    AND ap.role = ur.role
    AND ap.active = true
);

INSERT INTO public.user_roles (user_id, role, assigned_by)
SELECT DISTINCT p.user_id, ap.role, ap.created_by
FROM public.admin_phones ap
JOIN public.profiles p
  ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
WHERE ap.active = true
ON CONFLICT (user_id, role) DO UPDATE
SET assigned_by = EXCLUDED.assigned_by;