CREATE OR REPLACE FUNCTION public.enforce_chat_conversation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id
     OR OLD.site IS DISTINCT FROM NEW.site
     OR OLD.customer_name IS DISTINCT FROM NEW.customer_name
     OR OLD.customer_phone IS DISTINCT FROM NEW.customer_phone
     OR OLD.hidden_for_admin_at IS DISTINCT FROM NEW.hidden_for_admin_at
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Modification non autorisée de la conversation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_chat_conversation_update ON public.chat_conversations;
CREATE TRIGGER trg_enforce_chat_conversation_update
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_conversation_update();