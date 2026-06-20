-- Customer: notify when restaurant replies in chat
CREATE OR REPLACE FUNCTION public.notify_customer_chat_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cust_id uuid;
BEGIN
  IF NEW.sender_type = 'admin' THEN
    SELECT customer_id INTO cust_id
    FROM public.chat_conversations
    WHERE id = NEW.conversation_id;

    IF cust_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
      VALUES (
        cust_id,
        'Nouvelle réponse du restaurant',
        LEFT(NEW.content, 100),
        'new_message',
        NEW.conversation_id,
        NEW.site
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Customer: notify on order status change
CREATE OR REPLACE FUNCTION public.notify_customer_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  site_value text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
    VALUES (
      NEW.user_id,
      'Suivi de commande',
      'Votre commande #' || LEFT(NEW.id::text, 8) || ' est maintenant : ' || NEW.status,
      'new_order',
      NEW.id,
      site_value
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers (customer)
DROP TRIGGER IF EXISTS trg_notify_customer_chat_reply ON public.chat_messages;
CREATE TRIGGER trg_notify_customer_chat_reply
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_chat_reply();

DROP TRIGGER IF EXISTS trg_notify_customer_order_update ON public.orders;
CREATE TRIGGER trg_notify_customer_order_update
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_order_update();

-- Triggers (admin) - wire up existing functions
DROP TRIGGER IF EXISTS trg_notify_new_chat_message ON public.chat_messages;
CREATE TRIGGER trg_notify_new_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_chat_message();

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();