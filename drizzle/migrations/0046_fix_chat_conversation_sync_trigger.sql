CREATE OR REPLACE FUNCTION public.enforce_chat_conversation_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Mises à jour internes (trigger de synchronisation des messages) autorisées
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
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