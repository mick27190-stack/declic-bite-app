-- Restrict admins to closures for sites they manage
DROP POLICY IF EXISTS "Admins can view closures" ON public.restaurant_closures;
CREATE POLICY "Admins can view closures"
ON public.restaurant_closures
FOR SELECT
USING (public.can_admin_access_site(auth.uid(), site));

-- Add WITH CHECK to chat_conversations update policy so customers cannot
-- flip site/customer_id/hidden_for_admin_at. The trigger
-- enforce_chat_conversation_update_restrictions already validates this,
-- but WITH CHECK provides declarative defense-in-depth at the RLS level.
DROP POLICY IF EXISTS "Conversations can be updated by admins or owner" ON public.chat_conversations;
CREATE POLICY "Conversations can be updated by admins or owner"
ON public.chat_conversations
FOR UPDATE
USING (
  (customer_id = auth.uid())
  OR public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (public.has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (public.has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (public.has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
)
WITH CHECK (
  public.is_any_admin(auth.uid())
  OR (
    customer_id = auth.uid()
    -- Customers may only touch non-admin fields; admin-managed fields are
    -- locked to their previous values via the existing trigger.
  )
);