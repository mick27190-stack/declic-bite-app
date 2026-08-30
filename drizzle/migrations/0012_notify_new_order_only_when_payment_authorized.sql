DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_new_order_authorized ON public.orders;

-- Notify admins at INSERT only when the payment is already authorized/captured
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
WHEN (new.capture_status IN ('authorized', 'captured'))
EXECUTE FUNCTION public.notify_new_order();

-- Otherwise notify as soon as Stripe authorizes (or captures) the payment
CREATE TRIGGER trg_notify_new_order_authorized
AFTER UPDATE OF capture_status ON public.orders
FOR EACH ROW
WHEN (
  new.capture_status IN ('authorized', 'captured')
  AND (old.capture_status IS NULL OR old.capture_status NOT IN ('authorized', 'captured'))
)
EXECUTE FUNCTION public.notify_new_order();