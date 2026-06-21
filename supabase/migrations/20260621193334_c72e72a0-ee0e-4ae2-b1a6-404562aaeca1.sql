CREATE OR REPLACE FUNCTION public.should_receive_site_notification(_user_id uuid, _site text, _category text DEFAULT 'order'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH account AS (
    SELECT public.normalize_phone(coalesce(p.phone, au.phone)) AS phone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE au.id = _user_id
  ), active_admin AS (
    SELECT array_agg(DISTINCT ap.role) AS roles
    FROM public.admin_phones ap
    JOIN account a ON public.normalize_phone(ap.phone) = a.phone
    WHERE ap.active = true
  )
  SELECT
    CASE
      WHEN ('site_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
        OR ('secondary_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
        CASE
          -- Super admin principal: pendant les horaires uniquement, jamais de chat hors horaires.
          WHEN 'super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
            public.is_pizzeria_open()
          -- Super admin secondaire: tout pendant les horaires, chat seulement hors horaires.
          WHEN 'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
            CASE
              WHEN public.is_pizzeria_open() THEN true
              ELSE _category = 'chat'
            END
          -- Admin de site / admin secondaire de site: uniquement pendant les horaires.
          ELSE public.is_pizzeria_open()
        END

      -- Super admin principal sans rôle de site: ne reçoit jamais.
      WHEN 'super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN false

      -- Super admin secondaire non lié à ce site: chat hors horaires uniquement.
      WHEN 'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
        CASE
          WHEN public.is_pizzeria_open() THEN false
          ELSE _category = 'chat'
        END

      ELSE false
    END
  FROM active_admin;
$function$;