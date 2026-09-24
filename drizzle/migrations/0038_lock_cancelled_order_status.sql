-- Une commande annulée est définitive : le statut ne peut plus changer.
-- Les Edge Functions / service_role (auth.uid() IS NULL) gardent le contrôle total.
CREATE OR REPLACE FUNCTION public.enforce_cancelled_order_status_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null
     and old.status = 'cancelled'::order_status
     and new.status is distinct from old.status
  then
    raise exception 'Une commande annulée ne peut plus changer de statut';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS lock_cancelled_order_status ON public.orders;
CREATE TRIGGER lock_cancelled_order_status
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cancelled_order_status_lock();