CREATE OR REPLACE FUNCTION public.enforce_order_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Edge functions / service_role (auth.uid() IS NULL) and admins keep full control.
  if auth.uid() is null or public.is_any_admin(auth.uid()) then
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