-- Ensure realtime broadcasts read_at updates and new messages on chat tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_conversations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations';
  END IF;
END$$;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;

-- Allow secondary super admins to also mark received messages as read on both sites
DROP POLICY IF EXISTS "Participants can mark received messages read" ON public.chat_messages;
CREATE POLICY "Participants can mark received messages read"
ON public.chat_messages
FOR UPDATE
USING (
  sender_id <> auth.uid()
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'site_admin_conches'::public.app_role) AND site = 'conches')
    OR (public.has_role(auth.uid(), 'secondary_admin_conches'::public.app_role) AND site = 'conches')
    OR (public.has_role(auth.uid(), 'site_admin_beaumont'::public.app_role) AND site = 'beaumont')
    OR (public.has_role(auth.uid(), 'secondary_admin_beaumont'::public.app_role) AND site = 'beaumont')
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.customer_id = auth.uid()
    )
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'secondary_super_admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'site_admin_conches'::public.app_role) AND site = 'conches')
    OR (public.has_role(auth.uid(), 'secondary_admin_conches'::public.app_role) AND site = 'conches')
    OR (public.has_role(auth.uid(), 'site_admin_beaumont'::public.app_role) AND site = 'beaumont')
    OR (public.has_role(auth.uid(), 'secondary_admin_beaumont'::public.app_role) AND site = 'beaumont')
    OR EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id AND c.customer_id = auth.uid()
    )
  )
);