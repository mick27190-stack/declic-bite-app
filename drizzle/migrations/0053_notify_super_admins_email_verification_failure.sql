CREATE OR REPLACE FUNCTION public.notify_email_verification_failure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.template_name IN ('signup','email_change') AND NEW.status IN ('dlq','failed','bounced') THEN
    INSERT INTO public.notifications (user_id, title, body, type, reference_id, site, dedupe_key)
    SELECT DISTINCT ur.user_id,
      'Validation e-mail en échec',
      'Le lien de validation n''a pas pu être envoyé à ' || NEW.recipient_email || '. Voir Administration → Validations e-mail.',
      'email_verification_failed', NULL, 'all',
      'email_verif_fail:' || lower(NEW.recipient_email) || ':' || to_char(now(),'YYYYMMDD') || ':' || ur.user_id::text
    FROM public.user_roles ur
    WHERE ur.role IN ('super_admin'::app_role, 'secondary_super_admin'::app_role)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_email_verification_failure ON public.email_send_log;
CREATE TRIGGER trg_notify_email_verification_failure
AFTER INSERT ON public.email_send_log
FOR EACH ROW EXECUTE FUNCTION public.notify_email_verification_failure();