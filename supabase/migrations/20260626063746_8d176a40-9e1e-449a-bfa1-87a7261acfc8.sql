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
    -- Admin de site (principal ou secondaire) pour CE site :
    -- nouvelles commandes, accords/refus de livraison et messages chat,
    -- uniquement pendant les horaires d'ouverture.
    -- (Couvre aussi le Super Admin qui possède un profil admin de site.)
    (
      (
        ('site_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
        OR ('secondary_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
      )
      AND public.is_pizzeria_open()
    )
    OR
    -- Super Admin secondaire : messages chat des 2 sites uniquement,
    -- et uniquement en dehors des horaires d'ouverture.
    (
      'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
      AND _category = 'chat'
      AND NOT public.is_pizzeria_open()
    )
  FROM active_admin;
$function$;