ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK(type IN ('new_order','new_message','payment_canceled','order_update','delivery_estimate','delivery_response','loyalty_reward','invoice_request','email_verification_failed'));
CREATE OR REPLACE FUNCTION public.notify_email_verification_failure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.template_name IN ('signup','email_change') AND NEW.status IN ('failed','bounced') THEN
  INSERT INTO public.notifications(user_id,title,body,type,reference_id,site,dedupe_key)
  SELECT DISTINCT ur.user_id,'Validation e-mail en échec',
   'Le lien de validation n''a pas pu être envoyé à ' || NEW.recipient_email || '. Voir Administration → Validations e-mail.',
   'email_verification_failed',NULL::uuid,NULL::text,
   'email_verif_fail:' || lower(NEW.recipient_email) || ':' || to_char(NEW.created_at,'YYYYMMDD') || ':' || ur.user_id::text
  FROM public.user_roles ur WHERE ur.role IN ('super_admin'::app_role,'secondary_super_admin'::app_role)
  ON CONFLICT(dedupe_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_email_verification_failure() FROM PUBLIC,anon,authenticated;