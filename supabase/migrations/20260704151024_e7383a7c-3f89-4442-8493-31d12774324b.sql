-- Defense in depth: user_roles is auth-only and consumed by the has_role()
-- security-definer function + owner-scoped RLS. anon must have no access,
-- and authenticated should only keep the privileges its RLS policies need.

-- 1. Remove ALL access from anon (was accidentally granted full privileges).
REVOKE ALL ON public.user_roles FROM anon;

-- 2. Reset authenticated to the minimum matching the existing RLS policies
--    (SELECT own rows, INSERT/DELETE for site admins, UPDATE via super admin).
REVOKE ALL ON public.user_roles FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 3. Ensure the internal service keeps full access.
GRANT ALL ON public.user_roles TO service_role;

-- 4. Scope the super admin management policy to authenticated only
--    (was granted to PUBLIC, which needlessly included anon).
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
CREATE POLICY "Super admin can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
