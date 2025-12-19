-- Drop existing enum and recreate with new roles
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role app_role);
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP TABLE IF EXISTS public.user_roles;
DROP TYPE IF EXISTS public.app_role;

-- Create new role enum with all admin levels
CREATE TYPE public.app_role AS ENUM (
  'super_admin',           -- Admin principal - gère tout
  'site_admin_conches',    -- Admin site Conches
  'site_admin_beaumont',   -- Admin site Beaumont
  'secondary_admin_conches',  -- Admin secondaire Conches
  'secondary_admin_beaumont', -- Admin secondaire Beaumont
  'user'                   -- Utilisateur standard
);

-- Recreate user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  assigned_by uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any admin role
CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'site_admin_conches', 'site_admin_beaumont', 'secondary_admin_conches', 'secondary_admin_beaumont')
  )
$$;

-- Function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Super admin can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Site admins can manage secondary admins for their site"
ON public.user_roles
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'site_admin_conches') AND role = 'secondary_admin_conches')
  OR
  (public.has_role(auth.uid(), 'site_admin_beaumont') AND role = 'secondary_admin_beaumont')
);

CREATE POLICY "Site admins can delete secondary admins for their site"
ON public.user_roles
FOR DELETE
USING (
  (public.has_role(auth.uid(), 'site_admin_conches') AND role = 'secondary_admin_conches')
  OR
  (public.has_role(auth.uid(), 'site_admin_beaumont') AND role = 'secondary_admin_beaumont')
);

-- Table for admin phone numbers (to auto-assign roles on login)
CREATE TABLE public.admin_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  role app_role NOT NULL,
  site TEXT, -- 'conches' or 'beaumont' for site-specific admins
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.admin_phones ENABLE ROW LEVEL SECURITY;

-- Only super admin can manage admin phones
CREATE POLICY "Super admin can manage admin phones"
ON public.admin_phones
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Site admins can view and manage secondary admin phones for their site
CREATE POLICY "Site admins can view their site admin phones"
ON public.admin_phones
FOR SELECT
USING (
  (public.has_role(auth.uid(), 'site_admin_conches') AND site = 'conches')
  OR
  (public.has_role(auth.uid(), 'site_admin_beaumont') AND site = 'beaumont')
  OR
  public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Site admins can insert secondary admin phones for their site"
ON public.admin_phones
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'site_admin_conches') AND site = 'conches' AND role = 'secondary_admin_conches')
  OR
  (public.has_role(auth.uid(), 'site_admin_beaumont') AND site = 'beaumont' AND role = 'secondary_admin_beaumont')
);

CREATE POLICY "Site admins can delete secondary admin phones for their site"
ON public.admin_phones
FOR DELETE
USING (
  (public.has_role(auth.uid(), 'site_admin_conches') AND site = 'conches' AND role = 'secondary_admin_conches')
  OR
  (public.has_role(auth.uid(), 'site_admin_beaumont') AND site = 'beaumont' AND role = 'secondary_admin_beaumont')
);