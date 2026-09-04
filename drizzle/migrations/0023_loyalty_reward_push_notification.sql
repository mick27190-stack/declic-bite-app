ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'new_order'::text,
    'new_message'::text,
    'payment_canceled'::text,
    'order_update'::text,
    'delivery_estimate'::text,
    'delivery_response'::text,
    'loyalty_reward'::text
  ]));

CREATE OR REPLACE FUNCTION public.notify_loyalty_reward_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog record;
  cat_label text;
  reward_label text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO prog FROM public.loyalty_programs WHERE id = NEW.program_id;
  IF prog IS NULL THEN
    RETURN NEW;
  END IF;

  cat_label := CASE prog.category::text
    WHEN 'senior' THEN 'Senior'
    WHEN 'mega' THEN 'Méga'
    WHEN 'super_mega' THEN 'Super Méga'
    ELSE prog.category::text
  END;

  reward_label := CASE prog.reward_type::text
    WHEN 'free_pizza' THEN '1 pizza ' || cat_label || ' offerte'
    ELSE trim(to_char(COALESCE(prog.discount_amount, 0), 'FM999990D00')) || ' € de remise'
  END;

  INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
  VALUES (
    NEW.customer_id,
    'Récompense fidélité disponible !',
    'Votre carte ' || cat_label || ' est complète : ' || reward_label
      || ' automatiquement appliquée sur votre prochaine pizza ' || cat_label || '.',
    'loyalty_reward',
    NEW.id,
    prog.site,
    'loyalty_reward:' || NEW.id::text
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_loyalty_reward_available_trigger ON public.loyalty_rewards_pending;
CREATE TRIGGER notify_loyalty_reward_available_trigger
  AFTER INSERT ON public.loyalty_rewards_pending
  FOR EACH ROW EXECUTE FUNCTION public.notify_loyalty_reward_available();