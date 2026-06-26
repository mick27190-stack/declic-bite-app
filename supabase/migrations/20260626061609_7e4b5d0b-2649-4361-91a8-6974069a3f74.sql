CREATE POLICY "Livreurs can view profiles for their delivery orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = profiles.user_id
      AND o.order_type = 'livraison'
      AND public.can_livreur_access_order(auth.uid(), o.restaurant)
  )
);