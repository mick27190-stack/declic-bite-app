DROP POLICY IF EXISTS "Participants can mark received messages read" ON public.chat_messages;

CREATE POLICY "Participants can update received chat statuses"
ON public.chat_messages
FOR UPDATE
USING (
  (
    sender_type = 'customer'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
      OR (public.has_role(auth.uid(), 'site_admin_conches'::public.app_role) AND site = 'conches')
      OR (public.has_role(auth.uid(), 'secondary_admin_conches'::public.app_role) AND site = 'conches')
      OR (public.has_role(auth.uid(), 'site_admin_beaumont'::public.app_role) AND site = 'beaumont')
      OR (public.has_role(auth.uid(), 'secondary_admin_beaumont'::public.app_role) AND site = 'beaumont')
    )
  )
  OR
  (
    sender_type = 'admin'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.customer_id = auth.uid()
    )
  )
)
WITH CHECK (
  (
    sender_type = 'customer'
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
      OR (public.has_role(auth.uid(), 'site_admin_conches'::public.app_role) AND site = 'conches')
      OR (public.has_role(auth.uid(), 'secondary_admin_conches'::public.app_role) AND site = 'conches')
      OR (public.has_role(auth.uid(), 'site_admin_beaumont'::public.app_role) AND site = 'beaumont')
      OR (public.has_role(auth.uid(), 'secondary_admin_beaumont'::public.app_role) AND site = 'beaumont')
    )
  )
  OR
  (
    sender_type = 'admin'
    AND EXISTS (
      SELECT 1
      FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
        AND c.customer_id = auth.uid()
    )
  )
);