CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(coalesce(_phone, ''), '\D', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.should_receive_site_notification(_user_id uuid, _site text, _category text DEFAULT 'order'::text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH account AS (
    SELECT public.normalize_phone(coalesce(p.phone, au.phone)) AS phone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE au.id = _user_id
  ), active_admin AS (
    SELECT array_agg(DISTINCT ap.role) AS roles
    FROM public.admin_phones ap
    JOIN account a ON public.normalize_phone(ap.phone) = a.phone
    WHERE ap.active = true
  )
  SELECT
    CASE
      WHEN ('site_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
        OR ('secondary_admin_' || _site)::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
        CASE
          WHEN 'super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[]))
            OR 'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
            CASE
              WHEN public.is_pizzeria_open() THEN true
              ELSE _category = 'chat'
            END
          ELSE public.is_pizzeria_open()
        END

      WHEN 'super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN false

      WHEN 'secondary_super_admin'::app_role = ANY(coalesce(roles, ARRAY[]::app_role[])) THEN
        CASE
          WHEN public.is_pizzeria_open() THEN false
          ELSE _category = 'chat'
        END

      ELSE false
    END
  FROM active_admin;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  site_value text;
BEGIN
  site_value := public.restaurant_to_site(NEW.restaurant);

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
  SELECT u.user_id,
         'Nouvelle commande',
         'Une nouvelle commande a été reçue (' || NEW.total_price || '€)',
         'new_order',
         NEW.id,
         site_value,
         'new_order:' || NEW.id::text || ':' || u.user_id::text
  FROM (
    SELECT DISTINCT p.user_id
    FROM public.admin_phones ap
    JOIN public.profiles p
      ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
    WHERE ap.active = true
      AND ap.role IN (
        'super_admin'::app_role,
        'secondary_super_admin'::app_role,
        ('site_admin_' || site_value)::app_role,
        ('secondary_admin_' || site_value)::app_role
      )
  ) u
  WHERE u.user_id <> NEW.user_id
    AND public.should_receive_site_notification(u.user_id, site_value, 'order')
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_delivery_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  site_value text;
BEGIN
  IF NEW.delivery_response IS NOT NULL
     AND NEW.delivery_response IS DISTINCT FROM OLD.delivery_response
  THEN
    site_value := public.restaurant_to_site(NEW.restaurant);

    IF NEW.delivery_response = 'refused' AND NEW.status <> 'cancelled'::order_status THEN
      NEW.status := 'cancelled'::order_status;
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT u.user_id,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Horaire de livraison accepté'
                ELSE 'Horaire de livraison refusé' END,
           CASE WHEN NEW.delivery_response = 'accepted'
                THEN 'Le client a accepté l''horaire de livraison proposé pour la commande #' || LEFT(NEW.id::text, 8) || '.'
                ELSE 'Le client a refusé l''horaire de livraison. La commande #' || LEFT(NEW.id::text, 8) || ' a été annulée.' END,
           'new_order',
           NEW.id,
           site_value,
           'delivery_resp:' || NEW.id::text || ':' || NEW.delivery_response::text || ':' || u.user_id::text
    FROM (
      SELECT DISTINCT p.user_id
      FROM public.admin_phones ap
      JOIN public.profiles p
        ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
      WHERE ap.active = true
        AND ap.role IN (
          'super_admin'::app_role,
          'secondary_super_admin'::app_role,
          ('site_admin_' || site_value)::app_role,
          ('secondary_admin_' || site_value)::app_role
        )
    ) u
    WHERE public.should_receive_site_notification(u.user_id, site_value, 'delivery')
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT u.user_id,
           'Nouveau message',
           LEFT(NEW.content, 100),
           'new_message',
           NEW.conversation_id,
           NEW.site,
           'chat_msg:' || NEW.id::text || ':' || u.user_id::text
    FROM (
      SELECT DISTINCT p.user_id
      FROM public.admin_phones ap
      JOIN public.profiles p
        ON public.normalize_phone(p.phone) = public.normalize_phone(ap.phone)
      WHERE ap.active = true
        AND ap.role IN (
          'super_admin'::app_role,
          'secondary_super_admin'::app_role,
          ('site_admin_' || NEW.site)::app_role,
          ('secondary_admin_' || NEW.site)::app_role
        )
    ) u
    WHERE public.should_receive_site_notification(u.user_id, NEW.site, 'chat')
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_chat_message_notify ON public.chat_messages;