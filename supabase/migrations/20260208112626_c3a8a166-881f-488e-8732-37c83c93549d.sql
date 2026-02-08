
-- Table des messages du chat (remplace les mocks)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'admin')),
  content TEXT NOT NULL,
  site TEXT NOT NULL CHECK (site IN ('conches', 'beaumont')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des conversations
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  site TEXT NOT NULL CHECK (site IN ('conches', 'beaumont')),
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des notifications admin
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_order', 'new_message')),
  reference_id UUID,
  site TEXT NOT NULL CHECK (site IN ('conches', 'beaumont')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: chat_messages
CREATE POLICY "Admins can view chat messages for their site"
ON public.chat_messages FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (sender_id = auth.uid())
);

CREATE POLICY "Users can insert their own messages"
ON public.chat_messages FOR INSERT
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Admins can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'site_admin_conches'::app_role)
  OR has_role(auth.uid(), 'site_admin_beaumont'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_conches'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_beaumont'::app_role)
);

-- RLS: chat_conversations
CREATE POLICY "Admins can view conversations for their site"
ON public.chat_conversations FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND site = 'conches')
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND site = 'beaumont')
  OR (customer_id = auth.uid())
);

CREATE POLICY "Users can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Conversations can be updated by admins or owner"
ON public.chat_conversations FOR UPDATE
USING (
  customer_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'site_admin_conches'::app_role)
  OR has_role(auth.uid(), 'site_admin_beaumont'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_conches'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_beaumont'::app_role)
);

-- RLS: notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

-- Function: create notifications for new orders
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notification for all admins of the relevant site
  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
  SELECT ur.user_id, 
         'Nouvelle commande',
         'Une nouvelle commande a été reçue (' || NEW.total_price || '€)',
         'new_order',
         NEW.id,
         NEW.restaurant
  FROM public.user_roles ur
  WHERE (
    ur.role = 'super_admin'
    OR (ur.role = 'site_admin_conches' AND NEW.restaurant = 'conches')
    OR (ur.role = 'site_admin_beaumont' AND NEW.restaurant = 'beaumont')
    OR (ur.role = 'secondary_admin_conches' AND NEW.restaurant = 'conches')
    OR (ur.role = 'secondary_admin_beaumont' AND NEW.restaurant = 'beaumont')
  );
  RETURN NEW;
END;
$$;

-- Function: create notifications for new chat messages from customers
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'customer' THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site)
    SELECT ur.user_id,
           'Nouveau message',
           LEFT(NEW.content, 100),
           'new_message',
           NEW.conversation_id,
           NEW.site
    FROM public.user_roles ur
    WHERE (
      ur.role = 'super_admin'
      OR (ur.role = 'site_admin_conches' AND NEW.site = 'conches')
      OR (ur.role = 'site_admin_beaumont' AND NEW.site = 'beaumont')
      OR (ur.role = 'secondary_admin_conches' AND NEW.site = 'conches')
      OR (ur.role = 'secondary_admin_beaumont' AND NEW.site = 'beaumont')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER on_new_order_notify
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();

CREATE TRIGGER on_new_chat_message_notify
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_chat_message();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
