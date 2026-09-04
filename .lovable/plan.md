# Carte de fidélité virtuelle

Programme de fidélité par catégorie de pizza (Senior, Mega, Super Mega), paramétrable par site depuis un nouvel écran Admin réservé aux Super Admins.

## Règles retenues

- Programmes et compteurs **séparés par site** (Conches / Beaumont).
- Comptage et application de la récompense **au moment où le paiement Stripe est autorisé**.
- Pizzas éligibles : toutes les pizzas de la taille du programme (classiques, spéciales, végétariennes, gourmandes). **Bambino exclu.**
- Écran de paramétrage et vue d'ensemble : **Super Admins uniquement**.
- Un programme ne compte que si `enabled = true` **et** que la date du jour (heure de Paris) est dans `[start_date, end_date]`, bornes incluses, chaque borne vide valant « sans limite ».
- Les récompenses déjà acquises (`pending`) restent utilisables après la fin du programme, sauf annulation explicite par l'admin.

## Base de données

Trois nouvelles tables (RLS + GRANT dès la création) :

- `loyalty_programs` : `site`, `category` (senior / mega / super_mega), `enabled`, `start_date`, `end_date`, `required_count`, `reward_type` (free_pizza / discount_amount), `discount_amount`. Unicité sur (site, category).
- `customer_loyalty_progress` : `customer_id`, `program_id`, `current_count`. Unicité sur (customer_id, program_id).
- `loyalty_rewards_pending` : `customer_id`, `program_id`, `status` (pending / applied), `applied_order_id`, `created_at`, `applied_at`.

Accès : le client lit uniquement ses propres lignes de progression et de récompenses ; les Super Admins lisent tout et écrivent le paramétrage ; les écritures de compteurs passent par une fonction serveur.

Sur `orders`, ajout d'une colonne `loyalty_discount` (JSONB, nullable) décrivant la remise appliquée : programme, catégorie, type, montant déduit, nombre de pizzas offertes.

## Moteur de fidélité (serveur)

Fonction SQL `apply_loyalty_to_order(order_id)` en `SECURITY DEFINER`, appelée une seule fois par commande (verrou d'idempotence via `loyalty_discount` déjà renseigné) :

1. Détermine les programmes actifs pour le site de la commande.
2. Parcourt les pizzas éligibles de la commande **une par une, dans l'ordre** (une ligne de quantité 3 = 3 unités) :
   - récompense `pending` disponible → cette pizza est offerte (ou remisée du montant paramétré), la récompense passe à `applied` avec `applied_order_id`, le compteur n'augmente pas ;
   - sinon → `current_count + 1` ; si le seuil est atteint, remise à 0 et création d'une récompense `pending` (consommable dès la pizza suivante de la même commande).
3. Écrit le récapitulatif dans `orders.loyalty_discount` et déduit le montant du total.

Le calcul du total serveur (`compute_order_total` / `enforce_order_total_price`) intègre la remise fidélité pour que le montant autorisé par Stripe corresponde au montant remisé — la remise est donc calculée avant la création du PaymentIntent, puis validée définitivement à l'autorisation du paiement par le webhook.

## Côté client

- Nouvel item **« Carte de fidélité »** dans le menu client, affiché uniquement s'il existe au moins un programme actif sur le site sélectionné.
- Pour chaque catégorie active : barre de progression `current_count / required_count` et, si une récompense est en attente, le message « Récompense disponible sur ta prochaine pizza [catégorie] ! ».
- Le récapitulatif de commande (panier et confirmation) affiche la remise fidélité comme **ligne distincte** avant le total.

## Côté admin

- **Détail d'une commande** (`AdminOrdersPage`) : bloc dédié affichant la nature de la remise (pizza offerte ou montant), le programme concerné et le montant déduit du total.
- **Nouvel écran `/admin/loyalty`** (Super Admins) avec deux volets :
  - *Paramétrage* : une carte par catégorie et par site — toggle activer/désactiver, dates de début et de fin, seuil, type de récompense, montant si remise en €.
  - *Vue d'ensemble* : liste des clients avec leur barre de progression par programme et le statut des récompenses en attente, filtrable par site et par catégorie, avec possibilité d'annuler une récompense en attente.
- Boutons **Export CSV** et **Export PDF** de cette liste, alignés sur les exports existants.

## Ticket et facture

`OrderTicket.tsx` (ticket thermique 80 mm) et `src/lib/invoicePdf.ts` affichent une ligne distincte « Remise fidélité » avec le libellé du programme et le montant déduit, juste au-dessus du total.

## Détails techniques

- Migration unique créant les trois tables, l'enum de catégorie, les GRANT, les policies RLS, la colonne `orders.loyalty_discount` et la fonction `apply_loyalty_to_order`.
- Fichiers touchés : `src/App.tsx` (route), navigation admin dans `AdminDashboard.tsx`, `src/hooks/useRole.ts` (garde Super Admin), nouvelle page `src/pages/admin/AdminLoyaltyPage.tsx`, nouvelle page client `src/pages/LoyaltyCardPage.tsx`, `src/lib/loyalty.ts` (types + helpers + export CSV/PDF), `CartView.tsx`, `AdminOrdersPage.tsx`, `OrderTicket.tsx`, `src/lib/invoicePdf.ts`, `create-payment-intent` et le webhook Stripe.
- Dates évaluées en heure de Paris via `src/lib/parisTime.ts`.
- Régénération des types Supabase après la migration.
