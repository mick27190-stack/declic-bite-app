
-- Site-scoped chat_messages INSERT
DROP POLICY IF EXISTS "Admins can insert messages" ON public.chat_messages;
CREATE POLICY "Admins can insert messages" ON public.chat_messages
FOR INSERT WITH CHECK (
  is_super_admin(auth.uid())
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
);

-- Site-scoped chat_conversations UPDATE
DROP POLICY IF EXISTS "Conversations can be updated by admins or owner" ON public.chat_conversations;
CREATE POLICY "Conversations can be updated by admins or owner" ON public.chat_conversations
FOR UPDATE USING (
  customer_id = auth.uid()
  OR is_super_admin(auth.uid())
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
);

-- Fix mutable search_path on email-queue helper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
