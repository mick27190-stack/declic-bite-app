# SMS promotionnels : test, désinscription, coût réel

## 1. SMS test

- Bouton « Envoyer un SMS test » à côté de « Envoyer la campagne » dans la page SMS de l'admin, actif seulement si le message est rempli.
- Au clic, une petite fenêtre demande le numéro de test, pré-rempli avec le numéro du profil de l'admin connecté (même formatage +33 que le reste de l'app).
- Nouvelle fonction serveur `send-sms-test` : même contrôle d'accès que la campagne (Super Admin et Super Admins secondaires), envoi Twilio au seul numéro saisi, message préfixé `[TEST] `.
- Aucun impact : pas de lecture du fichier client, pas d'historique de campagne, pas de changement du compteur de destinataires. Pas de lien de désinscription ajouté au test.

## 2. Lien de désinscription + contrainte horaire

**Base de données** (une migration)
- Nouvelle table `sms_unsubscribe_tokens` (token, customer_id, user_id, phone, created_at, used_at), sur le modèle de la table équivalente pour l'email : RLS activée, aucun accès direct client (lecture/écriture par le serveur uniquement).
- Nouvelle table `sms_opt_outs` (phone, created_at) pour les clients sans compte (un consentement exige un compte client).
- `sms_marketing_recipients` renvoie en plus `customer_id` et `user_id`, et exclut les numéros présents dans `sms_opt_outs`.

**Page publique**
- `src/pages/UnsubscribeSMSPage.tsx`, route `/desabonnement-sms?token=…`, calquée sur la page de désinscription email (états : vérification, prêt, confirmé, lien invalide, erreur).

**Fonction serveur `handle-sms-unsubscribe`**
- GET : valide le token. POST : marque le token utilisé (opération atomique, pas de double usage) puis **insère** une ligne dans `consentements` (`type_consentement = 'sms_marketing'`, `accepte = false`) — jamais de mise à jour. Si le client n'a pas de compte, insertion dans `sms_opt_outs`.

**`send-promo-sms`**
- Avant tout envoi : refus explicite si l'heure de Paris n'est pas entre 8h et 20h, si on est dimanche, ou si c'est un jour férié français (calcul des 11 jours fériés, Pâques incluse, sans dépendance externe). Message d'erreur clair renvoyé à l'admin.
- Pour chaque destinataire : création d'un token et ajout en fin de message de « Stop: <lien> ». La longueur du lien est prise en compte dans le message final.

**Page admin**
- Mention informative : « Envoi possible uniquement entre 8h et 20h, hors dimanche et jours fériés », et bouton d'envoi désactivé hors de ce créneau.

## 3. Compteur de segments et coût

- Nouveau fichier `src/lib/smsSegments.ts` : détection GSM-7 (jeu standard + caractères étendus) vs Unicode, calcul des segments (160 / 153 en GSM-7 ; 70 / 67 en Unicode), et liste des caractères fautifs.
- La page admin utilise cette fonction pour la campagne et pour le SMS test, à la place de `Math.ceil(length / 160)`.
- Affichage avant envoi : encodage détecté, nombre réel de segments, et coût estimé = destinataires × segments × 0,0798 USD (le lien « Stop » est compté dans le message réel).
- Avertissement visible si le message force l'Unicode (emoji / caractères hors GSM-7), avec les caractères en cause et la suggestion de les retirer pour réduire le coût.

## Hors périmètre

Le flux de proposition d'horaire de livraison reste inchangé (push + email, aucun SMS).
