
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'livreur_conches';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'livreur_beaumont';

CREATE OR REPLACE FUNCTION public.is_livreur(_user_id uuid, _site text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'authz'
AS $function$
  SELECT authz.has_role(_user_id, ('livreur_' || _site)::public.app_role)
$function$;

CREATE OR REPLACE FUNCTION public.can_livreur_access_order(_user_id uuid, _restaurant text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'authz'
AS $function$
  SELECT public.is_livreur(_user_id, public.restaurant_to_site(_restaurant))
$function$;

CREATE POLICY "Livreurs can view delivery orders for their site"
ON public.orders
FOR SELECT
USING (
  order_type = 'livraison'
  AND public.can_livreur_access_order(auth.uid(), restaurant)
);

CREATE POLICY "Livreurs can update delivery orders for their site"
ON public.orders
FOR UPDATE
USING (
  order_type = 'livraison'
  AND public.can_livreur_access_order(auth.uid(), restaurant)
)
WITH CHECK (
  order_type = 'livraison'
  AND public.can_livreur_access_order(auth.uid(), restaurant)
);

CREATE OR REPLACE FUNCTION public.enforce_order_update_restrictions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Admins keep full control.
  if public.is_any_admin(auth.uid()) then
    return new;
  end if;

  -- Livreurs may ONLY mark a delivery order of their site as delivered.
  if public.can_livreur_access_order(auth.uid(), old.restaurant) then
    if new.total_price is distinct from old.total_price
       or new.items is distinct from old.items
       or new.restaurant is distinct from old.restaurant
       or new.order_type is distinct from old.order_type
       or new.pickup_time is distinct from old.pickup_time
       or new.delivery_address is distinct from old.delivery_address
       or new.delivery_estimate is distinct from old.delivery_estimate
       or new.user_id is distinct from old.user_id
    then
      raise exception 'Livreur cannot modify these order fields';
    end if;

    if new.status is distinct from old.status and new.status <> 'delivered'::order_status then
      raise exception 'Livreur can only mark an order as delivered';
    end if;

    return new;
  end if;

  -- Regular customers may only respond to a delivery proposal and cancel.
  if new.total_price is distinct from old.total_price
     or new.items is distinct from old.items
     or new.restaurant is distinct from old.restaurant
     or new.order_type is distinct from old.order_type
     or new.pickup_time is distinct from old.pickup_time
     or new.delivery_address is distinct from old.delivery_address
     or new.delivery_estimate is distinct from old.delivery_estimate
     or new.user_id is distinct from old.user_id
  then
    raise exception 'You are not allowed to modify these order fields';
  end if;

  if new.status is distinct from old.status and new.status <> 'cancelled'::order_status then
    raise exception 'You can only cancel your own order';
  end if;

  return new;
end;
$function$;
