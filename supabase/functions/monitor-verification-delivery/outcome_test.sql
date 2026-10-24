-- Transactional integration regression: rolled back, including outbound push jobs.
BEGIN;
DO $$
DECLARE
  email text := 'verification-monitor-' || gen_random_uuid()::text || '@example.invalid';
  msg text := gen_random_uuid()::text;
  stamp timestamptz := now();
  admins integer;
  alerts integer;
  inserted boolean;
BEGIN
  SELECT count(DISTINCT user_id) INTO admins FROM public.user_roles
    WHERE role IN ('super_admin','secondary_super_admin');
  IF admins=0 THEN RAISE EXCEPTION 'Requires existing Super Admin recipients'; END IF;
  INSERT INTO public.email_send_log(message_id,template_name,recipient_email,status,created_at)
    VALUES(msg,'email_change',email,'dlq',stamp);
  SELECT count(*) INTO alerts FROM public.notifications WHERE dedupe_key LIKE 'email_verif_fail:' || email || ':%';
  IF alerts<>0 THEN RAISE EXCEPTION 'Queue dead letter must not directly alert'; END IF;
  SELECT public.record_verification_delivery_outcome(jsonb_build_object('message_id',msg,'template_name','email_change','recipient_email',email,'status','failed','created_at',stamp)) INTO inserted;
  IF inserted IS DISTINCT FROM true THEN RAISE EXCEPTION 'First failure must be recorded'; END IF;
  SELECT count(*) INTO alerts FROM public.notifications WHERE dedupe_key LIKE 'email_verif_fail:' || email || ':%';
  IF alerts<>admins THEN RAISE EXCEPTION 'Every Super Admin must receive exactly one alert'; END IF;
  SELECT public.record_verification_delivery_outcome(jsonb_build_object('message_id',msg,'template_name','email_change','recipient_email',email,'status','failed','created_at',stamp)) INTO inserted;
  IF inserted IS DISTINCT FROM false THEN RAISE EXCEPTION 'Repeated outcome must deduplicate'; END IF;
  SELECT count(*) INTO alerts FROM public.notifications WHERE dedupe_key LIKE 'email_verif_fail:' || email || ':%';
  IF alerts<>admins THEN RAISE EXCEPTION 'Repeated outcome must not duplicate push'; END IF;
  PERFORM public.record_verification_delivery_outcome(jsonb_build_object('message_id',msg,'template_name','email_change','recipient_email',email,'status','sent','created_at',stamp+interval '1 second'));
  IF (SELECT status FROM public.email_send_log WHERE message_id=msg ORDER BY created_at DESC LIMIT 1)<>'sent' THEN
    RAISE EXCEPTION 'Later delivery success must replace failure in latest history';
  END IF;
END $$;
ROLLBACK;