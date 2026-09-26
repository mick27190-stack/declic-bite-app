CREATE POLICY "Site admins can view delivery tokens"
ON public.delivery_response_tokens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = delivery_response_tokens.order_id AND public.can_admin_access_order(auth.uid(), o.restaurant)));
GRANT SELECT ON public.delivery_response_tokens TO authenticated;