ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

DROP POLICY IF EXISTS "Participants can mark received messages read" ON public.chat_messages;
CREATE POLICY "Participants can mark received messages read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid() AND (
    is_super_admin(auth.uid())
    OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
    OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
    OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
    OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.customer_id = auth.uid()
    )
  )
)
WITH CHECK (
  sender_id <> auth.uid() AND (
    is_super_admin(auth.uid())
    OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
    OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
    OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
    OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.customer_id = auth.uid()
    )
  )
);

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;