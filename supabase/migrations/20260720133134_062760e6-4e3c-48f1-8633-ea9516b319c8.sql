
GRANT UPDATE, DELETE ON public.order_history TO authenticated;

CREATE POLICY "Admins can update order history"
ON public.order_history
FOR UPDATE
USING (public.is_any_admin(auth.uid()))
WITH CHECK (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can delete order history"
ON public.order_history
FOR DELETE
USING (public.is_any_admin(auth.uid()));
