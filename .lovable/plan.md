# Bouton « Demander une facture » dans les commandes en cours

## Ce que verra le client

Sous le suivi (timeline) de chaque commande en cours de la page Profil, un bouton
« Demander une facture ». Un clic envoie la demande, affiche une confirmation, puis le
bouton devient « Demande envoyée » (désactivé) pour éviter les doublons.

## Ce que recevra l'équipe

Une notification push et une notification dans la cloche de l'admin :

- Titre : `Demande de facture`
- Message : `Commande #<8 premiers caractères de l'id> — Prénom Nom`

Destinataires selon l'heure de Paris au moment de la demande :

- Entre 18h00 et 22h00 : les admins du site de la commande (admin de site + admin
  secondaire du site), comme pour une nouvelle commande.
- En dehors de ces horaires : les Super Admins secondaires.

L'envoi du PDF reste inchangé : l'admin utilise le bouton facture existant dans la
gestion des commandes.

## Détails techniques

**Base de données (migration)**

1. Table `public.invoice_requests` : `id uuid pk`, `order_id uuid references orders(id)`,
   `user_id uuid`, `site text`, `requested_at timestamptz default now()`,
   contrainte d'unicité sur `order_id`.
   GRANT `SELECT` à `authenticated`, `ALL` à `service_role` ; RLS activée ;
   policy SELECT : propriétaire (`user_id = auth.uid()`) ou admin du site
   (`can_admin_access_site`). Pas d'INSERT client direct — passage par la fonction.
2. Fonction `public.request_invoice(_order_id uuid)` (SECURITY DEFINER,
   `SET search_path = public`) :
   - vérifie que la commande appartient à `auth.uid()` ;
   - insère dans `invoice_requests` avec `ON CONFLICT (order_id) DO NOTHING`
     (si déjà demandé, sortie sans nouvelle notification) ;
   - calcule l'heure de Paris (`now() AT TIME ZONE 'Europe/Paris'`) ;
   - sélectionne les destinataires depuis `admin_phones` joint à `profiles`
     (même schéma que `notify_new_order`) : rôles
     `site_admin_<site>` + `secondary_admin_<site>` dans la plage 18h–22h,
     sinon `secondary_super_admin` ;
   - insère dans `notifications` avec `type = 'invoice_request'`,
     `reference_id = order_id`, `dedupe_key = 'invoice_request:<order_id>:<user_id>'`.
   Le trigger existant `send_push_on_notification` déclenche le push.
   GRANT `EXECUTE` à `authenticated`.

**Front**

- `src/pages/ProfilePage.tsx` : sous `<OrderTimeline order={order} />`, bouton
  (variant outline, pleine largeur) appelant `supabase.rpc('request_invoice', …)`,
  avec état de chargement, toast succès/erreur et état « Demande envoyée ».
  Chargement initial des `invoice_requests` du client pour connaître les commandes
  déjà demandées.
- `src/components/admin/NotificationBell.tsx` : traiter `invoice_request` comme une
  notification de commande (icône/navigation vers la gestion des commandes).
