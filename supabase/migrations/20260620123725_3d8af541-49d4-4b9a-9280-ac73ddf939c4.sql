-- Helper: treats secondary_super_admin exactly like super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'secondary_super_admin')
  )
$$;

-- Include secondary_super_admin in the global admin check
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'secondary_super_admin', 'site_admin_conches', 'site_admin_beaumont', 'secondary_admin_conches', 'secondary_admin_beaumont')
  )
$$;

-- admin_phones: super admin (and secondary) can manage all
DROP POLICY IF EXISTS "Super admin can manage admin phones" ON public.admin_phones;
CREATE POLICY "Super admin can manage admin phones"
ON public.admin_phones FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Site admins can view their site admin phones" ON public.admin_phones;
CREATE POLICY "Site admins can view their site admin phones"
ON public.admin_phones FOR SELECT
USING (
  (has_role(auth.uid(), 'site_admin_conches'::app_role) AND (site = 'conches'::text))
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND (site = 'beaumont'::text))
  OR public.is_super_admin(auth.uid())
);

-- user_roles: super admin (and secondary) can manage all roles
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- chat_conversations
DROP POLICY IF EXISTS "Admins can view conversations for their site" ON public.chat_conversations;
CREATE POLICY "Admins can view conversations for their site"
ON public.chat_conversations FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND (site = 'conches'::text))
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND (site = 'beaumont'::text))
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND (site = 'conches'::text))
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND (site = 'beaumont'::text))
  OR (customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Conversations can be updated by admins or owner" ON public.chat_conversations;
CREATE POLICY "Conversations can be updated by admins or owner"
ON public.chat_conversations FOR UPDATE
USING (
  (customer_id = auth.uid())
  OR public.is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'site_admin_conches'::app_role)
  OR has_role(auth.uid(), 'site_admin_beaumont'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_conches'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_beaumont'::app_role)
);

-- chat_messages
DROP POLICY IF EXISTS "Admins can insert messages" ON public.chat_messages;
CREATE POLICY "Admins can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'site_admin_conches'::app_role)
  OR has_role(auth.uid(), 'site_admin_beaumont'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_conches'::app_role)
  OR has_role(auth.uid(), 'secondary_admin_beaumont'::app_role)
);

DROP POLICY IF EXISTS "Admins can view chat messages for their site" ON public.chat_messages;
CREATE POLICY "Admins can view chat messages for their site"
ON public.chat_messages FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (has_role(auth.uid(), 'site_admin_conches'::app_role) AND (site = 'conches'::text))
  OR (has_role(auth.uid(), 'site_admin_beaumont'::app_role) AND (site = 'beaumont'::text))
  OR (has_role(auth.uid(), 'secondary_admin_conches'::app_role) AND (site = 'conches'::text))
  OR (has_role(auth.uid(), 'secondary_admin_beaumont'::app_role) AND (site = 'beaumont'::text))
  OR (sender_id = auth.uid())
  OR (EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id AND c.customer_id = auth.uid()))
);

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;