-- 1. chat_messages: restrict customer inserts to their own conversation
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
  )
);

-- 2. orders: enforce that customers can only change allowed fields
DROP TRIGGER IF EXISTS enforce_order_update_restrictions_trg ON public.orders;
CREATE TRIGGER enforce_order_update_restrictions_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_update_restrictions();
