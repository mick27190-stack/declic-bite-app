# Retirer les réponses client de l’administration

## Résultat attendu
- Dans les commandes administrateur, conserver uniquement le bandeau « En attente de réponse du client », l’horaire proposé, l’horaire demandé et le numéro de téléphone.
- Retirer les boutons « Confirmer au nom du client » et « Refuser au nom du client ».
- Conserver les boutons « Accepter » et « Refuser » dans le profil client et dans l’e-mail reçu.

## Protection
- Refuser côté serveur toute réponse provenant d’un administrateur, même par appel direct.
- Autoriser uniquement le propriétaire de la commande à répondre depuis son profil ; les liens uniques de l’e-mail restent traités par leur mécanisme sécurisé existant.

## Vérification
- Mettre à jour le test de l’espace administrateur pour vérifier l’absence des deux boutons et l’absence d’appel de réponse.
- Vérifier que l’application compile et que le bandeau d’attente reste visible.
