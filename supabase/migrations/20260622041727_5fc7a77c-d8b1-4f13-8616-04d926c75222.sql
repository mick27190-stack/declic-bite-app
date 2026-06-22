DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;

CREATE POLICY "Users can insert their own messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id
      AND c.customer_id = auth.uid()
  )
);