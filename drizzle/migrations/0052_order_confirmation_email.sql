ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.trigger_order_confirmation_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.confirmation_email_sent_at IS NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://tzamsbbpygevsdvugdbv.supabase.co/functions/v1/send-order-confirmation-email',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('order_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'order confirmation email trigger failed (order %): %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.trigger_order_confirmation_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_confirmation_email ON public.orders;
CREATE TRIGGER trg_order_confirmation_email AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_order_confirmation_email();