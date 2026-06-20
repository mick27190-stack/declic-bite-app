-- Customer file (fichier client): all customers, from registration or manually created by admins
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  site TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Only admins can read / manage the customer file
CREATE POLICY "Admins can view customers"
ON public.customers FOR SELECT TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (public.is_any_admin(auth.uid()));

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update signup handler to also record customer in the customer file
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, phone, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );

  INSERT INTO public.customers (user_id, phone, email, first_name, last_name, source)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'registration'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill existing registered users into the customer file
INSERT INTO public.customers (user_id, phone, email, first_name, last_name, site, source, created_at)
SELECT p.user_id, p.phone, p.email, p.first_name, p.last_name, p.preferred_restaurant, 'registration', p.created_at
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;