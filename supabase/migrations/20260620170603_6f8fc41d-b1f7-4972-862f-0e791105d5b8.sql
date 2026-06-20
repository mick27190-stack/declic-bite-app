-- 1. Add a deduplication key column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- 2. Enforce uniqueness on the dedupe key (allows multiple NULLs for other notifications)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 3. Recreate the customer order-update notification function with idempotent insert
CREATE OR REPLACE FUNCTION public.notify_customer_order_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  site_value text;
  status_label text;
  status_body text;
  dedupe text;
BEGIN
  -- Only react to actual preparation step (status) changes.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Resolve the restaurant site.
    IF lower(NEW.restaurant) LIKE '%conches%' THEN
      site_value := 'conches';
    ELSIF lower(NEW.restaurant) LIKE '%beaumont%' THEN
      site_value := 'beaumont';
    ELSE
      site_value := 'conches';
    END IF;

    -- Friendly French label + message per preparation step.
    CASE NEW.status::text
      WHEN 'pending' THEN
        status_label := 'En attente';
        status_body := 'Votre commande a bien été reçue et est en attente de confirmation.';
      WHEN 'confirmed' THEN
        status_label := 'Confirmée';
        status_body := 'Bonne nouvelle ! Votre commande a été confirmée par le restaurant.';
      WHEN 'preparing' THEN
        status_label := 'En préparation';
        status_body := 'Votre commande est en cours de préparation. 🍕';
      WHEN 'ready' THEN
        status_label := 'Prête';
        status_body := CASE WHEN NEW.order_type = 'livraison'
                            THEN 'Votre commande est prête et part en livraison !'
                            ELSE 'Votre commande est prête, vous pouvez venir la récupérer !' END;
      WHEN 'delivered' THEN
        status_label := 'Livrée';
        status_body := 'Votre commande a été livrée. Bon appétit ! 😋';
      WHEN 'cancelled' THEN
        status_label := 'Annulée';
        status_body := 'Votre commande a été annulée.';
      ELSE
        status_label := NEW.status::text;
        status_body := 'Le statut de votre commande a été mis à jour.';
    END CASE;

    -- Deduplication key: same order + status + update timestamp can only
    -- produce one notification, even if multiple events fire.
    dedupe := 'order_status:' || NEW.id::text || ':' || NEW.status::text || ':'
              || extract(epoch FROM COALESCE(NEW.updated_at, now()))::text;

    -- Send ONLY to the customer who placed the order. Idempotent insert.
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    VALUES (
      NEW.user_id,
      'Suivi de commande : ' || status_label,
      status_body,
      'new_order',
      NEW.id,
      site_value,
      dedupe
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;