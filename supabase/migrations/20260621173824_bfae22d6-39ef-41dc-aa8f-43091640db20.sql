-- Lock down all SECURITY DEFINER functions so they cannot be called directly
-- via the Data API by anon/authenticated. They still run inside RLS policies
-- and triggers (evaluated by the engine / table owner).

-- Helper functions used in RLS
REVOKE EXECUTE ON FUNCTION public.can_admin_access_site(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_admin_access_order(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.should_receive_site_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restaurant_to_site(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_pizzeria_open() FROM PUBLIC, anon, authenticated;

-- Trigger functions (only fired by triggers, never called directly)
REVOKE EXECUTE ON FUNCTION public.notify_new_chat_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_push_on_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_customer_chat_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_order_update_restrictions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_delivery_estimate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_customer_order_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_delivery_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_admin_phone_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- is_any_admin is called directly via RPC by the send-promo-sms edge function
-- using the signed-in user's client, so signed-in users must keep EXECUTE.
REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated;
