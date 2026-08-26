CREATE OR REPLACE FUNCTION public.consent_migration_stats(_version text)
RETURNS TABLE(total_clients integer, confirmed integer, pending integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE WHEN public.is_any_admin(auth.uid())
      THEN (SELECT count(*)::int FROM public.profiles) ELSE 0 END,
    CASE WHEN public.is_any_admin(auth.uid())
      THEN (SELECT count(DISTINCT p.user_id)::int
            FROM public.profiles p
            JOIN public.consentements c
              ON c.client_id = p.user_id
             AND c.type_consentement = 'cgv_politique'
             AND c.accepte = true
             AND c.version_document = _version)
      ELSE 0 END,
    CASE WHEN public.is_any_admin(auth.uid())
      THEN (SELECT count(*)::int
            FROM public.profiles p
            WHERE NOT EXISTS (
              SELECT 1 FROM public.consentements c
              WHERE c.client_id = p.user_id
                AND c.type_consentement = 'cgv_politique'
                AND c.accepte = true
                AND c.version_document = _version))
      ELSE 0 END
$$;

REVOKE ALL ON FUNCTION public.consent_migration_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consent_migration_stats(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consent_migration_stats(text) TO service_role;