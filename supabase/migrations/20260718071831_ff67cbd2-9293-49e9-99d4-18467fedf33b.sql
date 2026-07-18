CREATE POLICY "Admins can create conversations for their site"
ON public.chat_conversations
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid())
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
);