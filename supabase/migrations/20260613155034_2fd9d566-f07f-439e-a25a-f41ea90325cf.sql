ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_estimate text,
  ADD COLUMN IF NOT EXISTS delivery_response text;

CREATE POLICY "Users can respond to their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);