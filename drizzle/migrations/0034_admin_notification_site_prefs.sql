CREATE TABLE public.admin_notification_prefs (
  user_id uuid PRIMARY KEY,
  notify_conches boolean NOT NULL DEFAULT true,
  notify_beaumont boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.admin_notification_prefs TO authenticated;
GRANT ALL ON public.admin_notification_prefs TO service_role;

ALTER TABLE public.admin_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification prefs"
ON public.admin_notification_prefs FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own notification prefs"
ON public.admin_notification_prefs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own notification prefs"
ON public.admin_notification_prefs FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

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
  ), prefs AS (
    SELECT notify_conches, notify_beaumont
    FROM public.admin_notification_prefs
    WHERE user_id = _user_id
  )
  SELECT
    -- Préférence du compte : permet de couper les alertes d'un site.
    coalesce(
      CASE _site
        WHEN 'conches' THEN (SELECT notify_conches FROM prefs)
        WHEN 'beaumont' THEN (SELECT notify_beaumont FROM prefs)
        ELSE true
      END, true)
    AND (
      (
        (
          ('site_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
          OR ('secondary_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
        )
        AND public.is_pizzeria_open()
      )
      OR
      (
        'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
        AND _category = 'chat'
        AND NOT public.is_pizzeria_open()
      )
    )
  FROM active_admin;
$function$;

REVOKE EXECUTE ON FUNCTION public.should_receive_site_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;