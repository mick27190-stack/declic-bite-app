-- Revert last security migration that broke functionality

-- 1. Restore original chat_messages insert policy
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- 2. Remove the order update restriction trigger
DROP TRIGGER IF EXISTS enforce_order_update_restrictions_trg ON public.orders;