-- New client chat message -> notify admins, one notification per (message, recipient).
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM (SELECT DISTINCT user_id FROM public.user_roles) u
    WHERE public.should_receive_site_notification(u.user_id, NEW.site, 'chat')
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Restaurant reply -> notify the customer once per message.
CREATE OR REPLACE FUNCTION public.notify_customer_chat_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cust_id uuid;
BEGIN
  IF NEW.sender_type = 'admin' THEN
    SELECT customer_id INTO cust_id
    FROM public.chat_conversations
    WHERE id = NEW.conversation_id;

    IF cust_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
      VALUES (
        cust_id,
        'Nouvelle réponse du restaurant',
        LEFT(NEW.content, 100),
        'new_message',
        NEW.conversation_id,
        NEW.site,
        'chat_reply:' || NEW.id::text
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Delivery time proposal -> notify the customer once per proposed estimate.
CREATE OR REPLACE FUNCTION public.notify_delivery_estimate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  IF NEW.order_type = 'livraison'
     AND NEW.delivery_estimate IS NOT NULL
     AND NEW.delivery_estimate IS DISTINCT FROM OLD.delivery_estimate
     AND NEW.delivery_response IS NULL
  THEN
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    VALUES (
      NEW.user_id,
      'Horaire de livraison proposé',
      'Le restaurant propose une livraison à ' || NEW.delivery_estimate || '. Acceptez ou refusez cet horaire.',
      'new_order',
      NEW.id,
      site_value,
      'delivery_estimate:' || NEW.id::text || ':' || NEW.delivery_estimate::text
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Delivery accept/refuse -> notify admins, one notification per (event, recipient).
CREATE OR REPLACE FUNCTION public.notify_delivery_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
BEGIN
  IF NEW.delivery_response IS NOT NULL
     AND NEW.delivery_response IS DISTINCT FROM OLD.delivery_response
  THEN
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

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
    FROM (SELECT DISTINCT user_id FROM public.user_roles) u
    WHERE public.should_receive_site_notification(u.user_id, site_value, 'delivery')
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;