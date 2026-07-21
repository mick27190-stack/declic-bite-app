
-- Traçabilité RGPD des suppressions (sans identité)
CREATE TABLE public.account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  site text
);

GRANT SELECT ON public.account_deletion_log TO authenticated;
GRANT ALL ON public.account_deletion_log TO service_role;

ALTER TABLE public.account_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view deletion log"
ON public.account_deletion_log
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Fonction d'anonymisation des données personnelles liées à un utilisateur.
-- Conserve toutes les données comptables (montants, dates, restaurant, site, numéros de facture).
-- Idempotente : ne réécrit pas les lignes déjà anonymisées.
CREATE OR REPLACE FUNCTION public.anonymize_user_orders(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Commandes : on supprime l'adresse de livraison et les notes (PII),
  -- on garde total_price, created_at, restaurant, items (composition anonyme).
  UPDATE public.orders
     SET delivery_address = NULL,
         notes = NULL
   WHERE user_id = user_id_param
     AND (delivery_address IS NOT NULL OR notes IS NOT NULL);

  -- Fiche client : on conserve la ligne pour l'historique agrégé,
  -- mais on efface toute donnée identifiante.
  UPDATE public.customers
     SET first_name = 'Client',
         last_name  = 'supprimé',
         email = NULL,
         phone = NULL,
         address = NULL
   WHERE user_id = user_id_param
     AND (email IS NOT NULL OR phone IS NOT NULL OR address IS NOT NULL
          OR first_name IS DISTINCT FROM 'Client'
          OR last_name  IS DISTINCT FROM 'supprimé');

  -- Factures : obligation comptable de conserver les montants et numéros,
  -- mais on anonymise les champs identifiants.
  UPDATE public.invoices
     SET recipient_email = 'anonymise@declicpizza.local',
         customer_name = 'Client supprimé',
         customer_phone = NULL
   WHERE user_id = user_id_param
     AND customer_name IS DISTINCT FROM 'Client supprimé';

  -- Conversations chat : on retire le nom/téléphone affichés côté admin.
  UPDATE public.chat_conversations
     SET customer_name = 'Client supprimé',
         customer_phone = NULL,
         last_message = NULL
   WHERE customer_id = user_id_param
     AND customer_name IS DISTINCT FROM 'Client supprimé';
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_user_orders(uuid) TO service_role;
