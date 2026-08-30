DROP TRIGGER IF EXISTS trg_enforce_chat_conversation_update ON public.chat_conversations;

CREATE TRIGGER trg_enforce_chat_conversation_update
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_chat_conversation_update();