
-- 1. Fix chat_messages SELECT so conversation owners see all messages (incl. admin replies)
DROP POLICY IF EXISTS "Admins can view chat messages for their site" ON public.chat_messages;
CREATE POLICY "Admins can view chat messages for their site"
ON public.chat_messages
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches'::text)
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont'::text)
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches'::text)
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont'::text)
  OR sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.customer_id = auth.uid()
  )
);

-- 2. Realtime authorization: restrict presence/broadcast channels to authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can use admin presence channel" ON realtime.messages;
CREATE POLICY "Authenticated users can use admin presence channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (realtime.topic() = 'admin-presence');

DROP POLICY IF EXISTS "Authenticated users can broadcast on admin presence channel" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast on admin presence channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (realtime.topic() = 'admin-presence');

-- 3. Lock down SECURITY DEFINER helper/trigger functions from anonymous & public callers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_chat_message() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM anon, public, authenticated;
