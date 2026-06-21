-- ============================================================
-- 1. ORDERS SITE ISOLATION (server-side enforcement)
-- ============================================================
CREATE OR REPLACE FUNCTION public.restaurant_to_site(_restaurant text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(_restaurant) LIKE '%conches%' THEN 'conches'
    WHEN lower(_restaurant) LIKE '%beaumont%' THEN 'beaumont'
    ELSE 'conches'
  END
$$;

CREATE OR REPLACE FUNCTION public.can_admin_access_order(_user_id uuid, _restaurant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (public.has_role(_user_id, 'site_admin_conches'::app_role) AND public.restaurant_to_site(_restaurant) = 'conches')
    OR (public.has_role(_user_id, 'secondary_admin_conches'::app_role) AND public.restaurant_to_site(_restaurant) = 'conches')
    OR (public.has_role(_user_id, 'site_admin_beaumont'::app_role) AND public.restaurant_to_site(_restaurant) = 'beaumont')
    OR (public.has_role(_user_id, 'secondary_admin_beaumont'::app_role) AND public.restaurant_to_site(_restaurant) = 'beaumont')
$$;

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view orders for their site"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.can_admin_access_order(auth.uid(), restaurant));

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders for their site"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.can_admin_access_order(auth.uid(), restaurant))
  WITH CHECK (public.can_admin_access_order(auth.uid(), restaurant));

-- ============================================================
-- 2. SEND-PUSH WEBHOOK SECRET (server-side only config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) and SECURITY DEFINER
-- triggers may read/write this table. Anon/authenticated have no access.

INSERT INTO public.app_config (key, value)
VALUES ('send_push_secret', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- Update the push trigger to authenticate calls with the shared secret
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
declare
  push_secret text;
begin
  select value into push_secret from public.app_config where key = 'send_push_secret';

  perform net.http_post(
    url := 'https://tzamsbbpygevsdvugdbv.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(push_secret, '')
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'reference_id', NEW.reference_id
      )
    )
  );
  return NEW;
end;
$function$;