# Corriger l’aperçu d’impression du ticket

## Objectif
Rendre fiable l’ouverture de l’aperçu d’impression depuis « Imprimer le ticket » dans la gestion des commandes administrateur.

## Modifications
- Conserver le ticket sélectionné monté pendant toute la durée de l’aperçu, notamment sur Safari et mobile.
- Supprimer le nettoyage temporisé qui peut retirer le ticket avant que le navigateur ait fini de préparer l’aperçu.
- Garder l’impression limitée au ticket 80 mm, sans éléments de l’interface administrateur.
- Vérifier le clic, l’appel d’impression et le contenu rendu en mode impression.

## Hors périmètre
Aucune modification des commandes, paiements, factures ou règles métier.
