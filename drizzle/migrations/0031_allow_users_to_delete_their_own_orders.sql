-- Customers can delete their own orders (profile "Supprimer" button).
-- RLS still applies; admins keep their own policies. Invoiced orders are
-- blocked client-side so invoices (ON DELETE CASCADE) are never destroyed.
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;
CREATE POLICY "Users can delete their own orders"
ON public.orders
FOR DELETE TO authenticated
USING (auth.uid() = user_id);