-- 1. Server-side maintenance of conversation preview fields
CREATE OR REPLACE FUNCTION public.sync_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message = NEW.content,
      last_message_at = NEW.created_at,
      hidden_for_admin_at = CASE WHEN NEW.sender_type = 'customer' THEN NULL ELSE hidden_for_admin_at END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_last_message ON public.chat_messages;
CREATE TRIGGER trg_sync_conversation_last_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_last_message();

-- 2. Non-admin owners may not modify any conversation column
CREATE OR REPLACE FUNCTION public.enforce_chat_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
     OR OLD.site IS DISTINCT FROM NEW.site
     OR OLD.customer_name IS DISTINCT FROM NEW.customer_name
     OR OLD.customer_phone IS DISTINCT FROM NEW.customer_phone
     OR OLD.hidden_for_admin_at IS DISTINCT FROM NEW.hidden_for_admin_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.last_message IS DISTINCT FROM NEW.last_message
     OR OLD.last_message_at IS DISTINCT FROM NEW.last_message_at THEN
    RAISE EXCEPTION 'Modification non autorisée de la conversation';
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Chat messages: only delivery/read status may be updated
CREATE OR REPLACE FUNCTION public.enforce_chat_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id
     OR OLD.sender_type IS DISTINCT FROM NEW.sender_type
     OR OLD.content IS DISTINCT FROM NEW.content
     OR OLD.site IS DISTINCT FROM NEW.site
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Seuls les statuts de lecture/réception peuvent être modifiés';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_chat_message_update ON public.chat_messages;
CREATE TRIGGER trg_enforce_chat_message_update
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_message_update();

REVOKE EXECUTE ON FUNCTION public.sync_conversation_last_message() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_chat_message_update() FROM public, anon, authenticated;
