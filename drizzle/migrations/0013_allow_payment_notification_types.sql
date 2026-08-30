ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'new_order'::text,
    'new_message'::text,
    'payment_canceled'::text,
    'order_update'::text,
    'delivery_estimate'::text,
    'delivery_response'::text
  ]));