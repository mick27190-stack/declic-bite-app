# Simplifier le bloc Stripe dans la gestion des commandes admin

Oui, c'est faisable — et l'essentiel de l'automatisation existe déjà.

## État actuel (vérifié dans le code)

- Le changement de statut pilote déjà Stripe : passer une commande en « Confirmée » (ou En préparation / Prête / Livrée) appelle l'Edge Function `confirm-order` qui capture le paiement ; passer en « Annulée » appelle `cancel-order` qui libère la pré-autorisation.
- Les boutons manuels « Encaisser le paiement » / « Annuler la pré-autorisation » du panneau Stripe font donc doublon.
- Les commandes dont la pré-autorisation est annulée disparaissent de la liste admin : le filtre `isOrderPaymentAuthorized` (hook des commandes) et le compteur excluent `capture_status = cancelled`.

## Ce qui sera fait

1. **Retirer les actions manuelles** du panneau Stripe : plus de bouton d'encaissement ni d'annulation. Le panneau ne garde que le badge de statut du paiement, l'identifiant PaymentIntent et l'historique dépliable.
2. **Automatisation confirmée** : le passage au statut « Confirmée » déclenche la capture Stripe, et le badge passe à « Paiement encaissé ». Si la capture échoue, la commande ne bascule pas en confirmée et une erreur claire s'affiche (comportement conservé).
3. **Rendre les commandes annulées visibles** dans le suivi des commandes :
   - une commande ayant eu un paiement (PaymentIntent existant) reste affichée même après annulation de la pré-autorisation, avec le badge « Autorisation annulée » ;
   - restent masquées les commandes jamais autorisées (paniers abandonnés, paiement échoué / en attente).
   - Cela couvre les deux cas demandés : annulation par l'admin de site, et refus par le client du nouvel horaire de livraison proposé (`respond-to-delivery-time` / lien e-mail passent déjà la commande en `cancelled` + `capture_status = cancelled`).
4. **Compteurs** : le compteur « commande(s) en temps réel » et le total cumulé seront alignés sur la même règle d'affichage pour rester cohérents avec la liste. Le filtre de statut « Annulée » permettra de les isoler.

## Détails techniques

- `src/components/admin/StripeStatusPanel.tsx` : suppression des props `busy` / `onCapture` / `onCancelAuth` et du bloc d'actions ; conservation du badge, du PaymentIntent et de la timeline.
- `src/pages/admin/AdminOrdersPage.tsx` : suppression des handlers manuels passés au panneau ; `handleStatusChange` inchangé ; ajustement de la requête de comptage (`refreshCounters`) pour inclure les annulées autorisées.
- `src/hooks/useOrders.ts` : `isOrderPaymentAuthorized` renvoie désormais `true` pour `capture_status` `cancelled`/`canceled` lorsqu'un `stripe_payment_intent_id` existe (ou que le statut n'est pas `pending`), et continue d'exclure `pending`.
- Aucune modification de base de données ni d'Edge Function nécessaire.
