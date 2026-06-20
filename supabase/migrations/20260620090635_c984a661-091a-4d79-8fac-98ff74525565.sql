-- 1. ORDERS: restrict which columns customers can change via a trigger
create or replace function public.enforce_order_update_restrictions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins keep full control.
  if public.is_any_admin(auth.uid()) then
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
$$;

drop trigger if exists trg_enforce_order_update on public.orders;
create trigger trg_enforce_order_update
before update on public.orders
for each row execute function public.enforce_order_update_restrictions();

-- 2. USER_ROLES: prevent self-assignment of admin roles; scope policies to authenticated
drop policy if exists "Site admins can manage secondary admins for their site" on public.user_roles;
create policy "Site admins can insert secondary admins for their site"
on public.user_roles for insert to authenticated
with check (
  auth.uid() <> user_id and (
    (has_role(auth.uid(), 'site_admin_conches'::app_role) and role = 'secondary_admin_conches'::app_role)
    or (has_role(auth.uid(), 'site_admin_beaumont'::app_role) and role = 'secondary_admin_beaumont'::app_role)
  )
);

drop policy if exists "Site admins can delete secondary admins for their site" on public.user_roles;
create policy "Site admins can delete secondary admins for their site"
on public.user_roles for delete to authenticated
using (
  (has_role(auth.uid(), 'site_admin_conches'::app_role) and role = 'secondary_admin_conches'::app_role)
  or (has_role(auth.uid(), 'site_admin_beaumont'::app_role) and role = 'secondary_admin_beaumont'::app_role)
);

drop policy if exists "Users can view their own roles" on public.user_roles;
create policy "Users can view their own roles"
on public.user_roles for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Super admin can manage all roles" on public.user_roles;
create policy "Super admin can manage all roles"
on public.user_roles for all to authenticated
using (has_role(auth.uid(), 'super_admin'::app_role))
with check (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Lock down internal trigger functions from direct API execution
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.notify_new_chat_message() from public, anon, authenticated;
revoke execute on function public.notify_new_order() from public, anon, authenticated;
revoke execute on function public.send_push_on_notification() from public, anon, authenticated;
revoke execute on function public.enforce_order_update_restrictions() from public, anon, authenticated;