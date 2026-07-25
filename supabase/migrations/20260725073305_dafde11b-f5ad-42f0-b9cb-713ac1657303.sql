
CREATE OR REPLACE FUNCTION public.enforce_chat_conversation_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_any_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.site IS DISTINCT FROM OLD.site
     OR NEW.hidden_for_admin_at IS DISTINCT FROM OLD.hidden_for_admin_at THEN
    RAISE EXCEPTION 'You are not allowed to modify these conversation fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_chat_conversation_update ON public.chat_conversations;
CREATE TRIGGER trg_enforce_chat_conversation_update
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_conversation_update_restrictions();
