CREATE OR REPLACE FUNCTION public.record_invoice(
  _order_id uuid,
  _invoice_number text,
  _storage_path text,
  _total_ttc numeric,
  _recipient_email text,
  _customer_name text,
  _customer_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
BEGIN
  SELECT id, user_id, restaurant, site INTO o FROM public.orders WHERE id = _order_id;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  -- Seul le client propriétaire ou un admin du site peut enregistrer la facture
  IF NOT (o.user_id = auth.uid() OR public.can_admin_access_site(auth.uid(), COALESCE(o.site, public.restaurant_to_site(o.restaurant)))) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  INSERT INTO public.invoices (
    order_id, user_id, invoice_number, storage_path, total_ttc,
    recipient_email, customer_name, customer_phone, restaurant, site, sent_at
  ) VALUES (
    o.id, o.user_id, _invoice_number, _storage_path, _total_ttc,
    _recipient_email, _customer_name, _customer_phone, o.restaurant,
    COALESCE(o.site, public.restaurant_to_site(o.restaurant)), now()
  )
  ON CONFLICT (invoice_number) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    total_ttc = EXCLUDED.total_ttc,
    recipient_email = EXCLUDED.recipient_email,
    customer_name = COALESCE(EXCLUDED.customer_name, public.invoices.customer_name),
    customer_phone = COALESCE(EXCLUDED.customer_phone, public.invoices.customer_phone),
    sent_at = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_invoice(uuid, text, text, numeric, text, text, text) TO authenticated;