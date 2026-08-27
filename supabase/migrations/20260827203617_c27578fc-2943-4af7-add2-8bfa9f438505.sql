-- 1) Nettoyage des doublons consécutifs identiques (on garde la première trace)
WITH ordered AS (
  SELECT id,
         client_id,
         type_consentement,
         accepte,
         coalesce(version_document,'') AS v,
         coalesce(motif_refus,'') AS m,
         lag(accepte) OVER w AS prev_accepte,
         lag(coalesce(version_document,'')) OVER w AS prev_v,
         lag(coalesce(motif_refus,'')) OVER w AS prev_m
  FROM public.consentements
  WINDOW w AS (PARTITION BY client_id, type_consentement ORDER BY date_consentement, id)
)
DELETE FROM public.consentements c
USING ordered o
WHERE c.id = o.id
  AND o.prev_accepte IS NOT NULL
  AND o.accepte IS NOT DISTINCT FROM o.prev_accepte
  AND o.v = o.prev_v
  AND o.m = o.prev_m;

-- 2) Empêche l'enregistrement d'un consentement identique au dernier connu
CREATE OR REPLACE FUNCTION public.skip_duplicate_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_row public.consentements%ROWTYPE;
BEGIN
  SELECT * INTO last_row
  FROM public.consentements
  WHERE client_id = NEW.client_id
    AND type_consentement = NEW.type_consentement
  ORDER BY date_consentement DESC, id DESC
  LIMIT 1;

  IF FOUND
     AND last_row.accepte IS NOT DISTINCT FROM NEW.accepte
     AND coalesce(last_row.version_document,'') = coalesce(NEW.version_document,'')
     AND coalesce(last_row.motif_refus,'') = coalesce(NEW.motif_refus,'')
  THEN
    RETURN NULL; -- aucun changement de choix : pas de nouvelle ligne
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skip_duplicate_consent_trigger ON public.consentements;
CREATE TRIGGER skip_duplicate_consent_trigger
BEFORE INSERT ON public.consentements
FOR EACH ROW EXECUTE FUNCTION public.skip_duplicate_consent();