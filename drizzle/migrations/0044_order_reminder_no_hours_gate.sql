CREATE OR REPLACE FUNCTION public.remind_unacked_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  o RECORD;
  site_value text;
  body_text text;
  minute_key text;
BEGIN
  minute_key := to_char(now(), 'YYYYMMDDHH24MI');

  FOR o IN
    SELECT id, restaurant, order_type, total_price, pickup_time
    FROM public.orders
    WHERE acquittee_le IS NULL
      AND status = 'pending'
      AND capture_status = 'authorized'
      AND created_at > now() - interval '3 hours'
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    site_value := public.restaurant_to_site(o.restaurant);

    IF o.order_type = 'livraison' THEN
      body_text := '🚗 Livraison';
    ELSE
      body_text := '🏪 À emporter';
    END IF;
    body_text := body_text || ' • ' || o.total_price || '€';
    IF o.pickup_time IS NOT NULL AND o.pickup_time <> '' THEN
      body_text := body_text || ' • ' || o.pickup_time;
    END IF;

    -- Rappel : envoyé tant que la commande n'est pas acquittée, même hors
    -- horaires d'ouverture. Respecte les rôles admin du site et le réglage
    -- « Recevoir les alertes de » (admin_notification_prefs, activé par défaut).
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT u.user_id,
           '⏰ Rappel : commande en attente',
           body_text || ' • À marquer « J''ai vu »',
           'new_order',
           o.id,
           site_value,
           'order_reminder:' || o.id::text || ':' || u.user_id::text || ':' || minute_key
    FROM (
      SELECT DISTINCT p.user_id
      FROM public.admin_phones ap
      JOIN public.profiles p
        ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
      WHERE ap.active = true
        AND ap.role IN (
          'super_admin'::app_role,
          ('site_admin_' || site_value)::app_role,
          ('secondary_admin_' || site_value)::app_role
        )
    ) u
    WHERE coalesce(
      (SELECT CASE WHEN site_value = 'conches' THEN pr.notify_conches ELSE pr.notify_beaumont END
       FROM public.admin_notification_prefs pr WHERE pr.user_id = u.user_id),
      true
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.remind_unacked_orders() FROM anon, public, authenticated;