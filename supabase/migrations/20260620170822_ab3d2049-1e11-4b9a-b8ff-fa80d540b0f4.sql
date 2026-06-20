DROP INDEX IF EXISTS public.notifications_dedupe_key_uidx;

CREATE UNIQUE INDEX notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key);