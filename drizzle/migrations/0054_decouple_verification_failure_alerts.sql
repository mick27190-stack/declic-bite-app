-- lovable-cron-fallback-reviewed: delivery rejections have no receiver webhook; independent one-minute history reconciliation preserves prompt failure alerts after transport replacement.
CREATE TABLE public.verification_delivery_monitor_state (id integer PRIMARY KEY CHECK (id=1), checked_until timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.verification_delivery_monitor_state TO service_role;
ALTER TABLE public.verification_delivery_monitor_state ENABLE ROW LEVEL SECURITY;
INSERT INTO public.verification_delivery_monitor_state(id) VALUES (1);
CREATE TABLE public.verification_delivery_observations (outcome_key text PRIMARY KEY, observed_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.verification_delivery_observations TO service_role;
ALTER TABLE public.verification_delivery_observations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.record_verification_delivery_outcome(outcome jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_key text;
BEGIN
  IF coalesce(outcome->>'template_name','') NOT IN ('signup','email_change') OR coalesce(outcome->>'status','') NOT IN ('failed','bounced','sent') OR coalesce(outcome->>'recipient_email','')='' OR outcome->>'created_at' IS NULL THEN
    RAISE EXCEPTION 'Invalid verification outcome';
  END IF;
  INSERT INTO public.verification_delivery_observations(outcome_key)
  VALUES (md5(concat_ws(':',outcome->>'message_id',lower(outcome->>'recipient_email'),outcome->>'template_name',outcome->>'status',outcome->>'created_at')))
  ON CONFLICT DO NOTHING RETURNING outcome_key INTO inserted_key;
  IF inserted_key IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.email_send_log l WHERE l.message_id IS NOT DISTINCT FROM outcome->>'message_id' AND lower(l.recipient_email)=lower(outcome->>'recipient_email') AND l.template_name=outcome->>'template_name' AND l.status=outcome->>'status' AND l.created_at=(outcome->>'created_at')::timestamptz) THEN
    INSERT INTO public.email_send_log(message_id,template_name,recipient_email,status,error_message,created_at)
    VALUES (outcome->>'message_id',outcome->>'template_name',lower(outcome->>'recipient_email'),outcome->>'status',outcome->>'error_message',(outcome->>'created_at')::timestamptz);
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.record_verification_delivery_outcome(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_verification_delivery_outcome(jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.notify_email_verification_failure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Never react to queue dead letters; the independent observer maps rejections.
  IF NEW.template_name IN ('signup','email_change') AND NEW.status IN ('failed','bounced') THEN
    INSERT INTO public.notifications (user_id,title,body,type,reference_id,site,dedupe_key)
    SELECT DISTINCT ur.user_id,'Validation e-mail en échec',
      'Le lien de validation n''a pas pu être envoyé à ' || NEW.recipient_email || '. Voir Administration → Validations e-mail.',
      'email_verification_failed',NULL,'all',
      'email_verif_fail:' || lower(NEW.recipient_email) || ':' || to_char(NEW.created_at,'YYYYMMDD') || ':' || ur.user_id::text
    FROM public.user_roles ur
    WHERE ur.role IN ('super_admin'::app_role,'secondary_super_admin'::app_role)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_email_verification_failure() FROM PUBLIC,anon,authenticated;
DO $schedule$ BEGIN
  PERFORM cron.schedule('monitor-verification-delivery','* * * * *',$job$
    SELECT net.http_post(
      url := 'https://tzamsbbpygevsdvugdbv.supabase.co/functions/v1/monitor-verification-delivery',
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',(SELECT value FROM public.app_config WHERE key='send_push_secret')),
      body := '{}'::jsonb
    );
  $job$);
END $schedule$;