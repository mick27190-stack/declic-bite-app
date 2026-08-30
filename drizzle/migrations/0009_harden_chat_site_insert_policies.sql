DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;
CREATE POLICY "Users can create conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND site IN ('conches', 'beaumont')
);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_messages.conversation_id
      AND c.customer_id = auth.uid()
      AND c.site = chat_messages.site
  )
);