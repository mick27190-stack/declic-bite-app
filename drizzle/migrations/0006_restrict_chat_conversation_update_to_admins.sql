DROP POLICY IF EXISTS "Conversations can be updated by admins or owner" ON public.chat_conversations;

CREATE POLICY "Conversations can be updated by admins"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'site_admin_conches') AND site = 'conches')
  OR (public.has_role(auth.uid(), 'secondary_admin_conches') AND site = 'conches')
  OR (public.has_role(auth.uid(), 'site_admin_beaumont') AND site = 'beaumont')
  OR (public.has_role(auth.uid(), 'secondary_admin_beaumont') AND site = 'beaumont')
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'site_admin_conches') AND site = 'conches')
  OR (public.has_role(auth.uid(), 'secondary_admin_conches') AND site = 'conches')
  OR (public.has_role(auth.uid(), 'site_admin_beaumont') AND site = 'beaumont')
  OR (public.has_role(auth.uid(), 'secondary_admin_beaumont') AND site = 'beaumont')
);