CREATE TABLE public.consentements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  type_consentement text NOT NULL CHECK (type_consentement IN ('cgv_politique','sms_marketing')),
  accepte boolean NOT NULL,
  version_document text,
  date_consentement timestamptz NOT NULL DEFAULT now(),
  adresse_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consentements_client_type ON public.consentements (client_id, type_consentement, date_consentement DESC);

GRANT SELECT, INSERT ON public.consentements TO authenticated;
GRANT ALL ON public.consentements TO service_role;

ALTER TABLE public.consentements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients voient leurs propres consentements"
ON public.consentements FOR SELECT TO authenticated
USING (auth.uid() = client_id);

CREATE POLICY "Clients enregistrent leurs propres consentements"
ON public.consentements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_id);