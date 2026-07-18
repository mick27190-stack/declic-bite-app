
CREATE TABLE public.delivery_response_tokens (
  token uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('accepted','refused')),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_response_tokens_order ON public.delivery_response_tokens(order_id);

GRANT SELECT ON public.delivery_response_tokens TO authenticated;
GRANT ALL ON public.delivery_response_tokens TO service_role;

ALTER TABLE public.delivery_response_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own delivery tokens"
ON public.delivery_response_tokens FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.issue_delivery_response_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_type = 'livraison'
     AND NEW.delivery_estimate IS NOT NULL
     AND NEW.delivery_estimate IS DISTINCT FROM OLD.delivery_estimate
     AND NEW.delivery_response IS NULL
  THEN
    DELETE FROM public.delivery_response_tokens
    WHERE order_id = NEW.id AND used_at IS NULL;

    INSERT INTO public.delivery_response_tokens (order_id, action)
    VALUES (NEW.id, 'accepted'), (NEW.id, 'refused');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_delivery_response_tokens ON public.orders;
CREATE TRIGGER trg_issue_delivery_response_tokens
AFTER UPDATE OF delivery_estimate ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.issue_delivery_response_tokens();
