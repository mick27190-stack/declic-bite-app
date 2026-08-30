DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;

CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.capture_status IS NOT NULL AND NEW.capture_status <> 'cancelled')
EXECUTE FUNCTION public.notify_new_order();

CREATE TRIGGER trg_notify_new_order_authorized
AFTER UPDATE OF capture_status ON public.orders
FOR EACH ROW
WHEN (
  NEW.capture_status IS NOT NULL
  AND NEW.capture_status <> 'cancelled'
  AND OLD.capture_status IS DISTINCT FROM NEW.capture_status
  AND OLD.capture_status IS NULL
)
EXECUTE FUNCTION public.notify_new_order();