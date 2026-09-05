# Mise en conformité du document de facture

Aucun changement sur les montants, le flux Stripe ou les statuts de commande. Seuls le contenu du document, la numérotation et le moment où le numéro est attribué évoluent.

## 1. Ventilation TVA supprimée

Dans le document PDF, les lignes "Total HT", "TVA (10%)" et "TOTAL TTC" disparaissent. Il ne reste que le montant total déjà calculé (repris tel quel, sans recalcul), affiché comme "TOTAL", suivi de la mention :

"TVA non applicable, art. 293 B du CGI"

Le sous-total et la ligne "Fidélité" restent affichés quand une remise existe.

## 2. Identité légale de l'exploitant

Juste sous le nom commercial en en-tête :
- Conches-en-Ouche : Thierry DUPONT, EI
- Beaumont-le-Roger : Flora DUPONT, EI

Le choix suit exactement la logique déjà utilisée pour l'adresse et le SIRET (résolution de l'établissement depuis la commande).

## 3. Mentions B2B supprimées

Le bloc "Pas d'escompte…", "Pénalités de retard…", "Indemnité forfaitaire 40 €…" est retiré et remplacé par :

"Facture réglée intégralement en ligne à la commande."

La mention "Règlement non encaissé" pour les commandes annulées est conservée.

## 4. Numérotation séquentielle par établissement et par année

- Nouvelle table `invoice_counters` et fonction `next_invoice_number(p_establishment_id text, p_year int)` (SQL fourni, `security definer`, accessible uniquement au rôle serveur).
- Nouvelle colonne `invoice_number` (texte, nullable) sur `orders`.
- Le numéro est attribué **uniquement côté serveur, au moment de la capture du paiement Stripe** : dans la fonction de confirmation de commande et dans la branche "horaire accepté" de la réponse de livraison. Rien n'est généré à la création de la commande, ni à l'affichage, ni depuis le navigateur.
- Format : `F-{année}-{CODE}-{6 chiffres}` avec CODE = CONC ou BEAU (ex. F-2026-BEAU-000123).
- Si la commande porte déjà un `invoice_number`, il est réutilisé et jamais régénéré. Une commande annulée ne consomme aucun numéro.

## 5. Facture ou récapitulatif selon l'état du paiement

Le document (e-mail, profil client, back-office) s'adapte :

- Paiement capturé et commande confirmée : titre "FACTURE" + le numéro séquentiel.
- Paiement seulement pré-autorisé : titre "Récapitulatif de commande", même contenu, sans le mot facture ni numéro, avec la mention "Facture disponible une fois votre commande confirmée par l'établissement."
- Commande annulée : "Récapitulatif de commande" avec la mention "Commande annulée".

Le bouton client "Demander une facture" et l'envoi depuis le back-office continuent de fonctionner ; ils envoient le récapitulatif tant que le paiement n'est pas capturé.

## Détails techniques

- Migration : `CREATE TABLE public.invoice_counters` + grants (`service_role` uniquement), `next_invoice_number` en `security definer` avec `search_path = public`, `ALTER TABLE public.orders ADD COLUMN invoice_number text` (nullable, additif).
- `supabase/functions/confirm-order/index.ts` et `supabase/functions/respond-to-delivery-time/index.ts` : après capture réussie, si `order.invoice_number` est vide, appel RPC `next_invoice_number` puis écriture du numéro formaté dans le même `update` que les statuts existants (aucune modification de la logique de capture).
- `src/lib/invoicePdf.ts` : suppression du bloc TVA (constante `TVA_RATE` retirée), titre dynamique FACTURE / Récapitulatif de commande, mentions légales mises à jour, nom de l'exploitant via une table de correspondance site → nom (`conches` → Thierry DUPONT, EI ; `beaumont` → Flora DUPONT, EI). La signature retourne toujours le total ; les champs HT/TVA ne sont plus utilisés par les appelants.
- `src/lib/sendInvoice.ts` : `buildInvoiceNumber` n'est plus utilisé pour numéroter ; on utilise `order.invoice_number` s'il existe. Sans numéro (paiement non capturé), le document est un récapitulatif, le nom de fichier et la ligne archivée dans "Factures" utilisent une référence de commande au lieu d'un numéro de facture, afin de ne pas polluer la séquence.
- `src/types/order.ts` : ajout du champ optionnel `invoice_number`.
