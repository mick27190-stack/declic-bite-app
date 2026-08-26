# Consentements RGPD à l'inscription

## Fichiers modifiés / créés

1. **`src/pages/AuthPage.tsx`** (formulaire d'inscription)
   - Case 1 obligatoire : « J'ai lu et j'accepte les Conditions Générales de Vente et la Politique de confidentialité », avec liens cliquables ouvrant `/cgv` et `/confidentialite` dans un nouvel onglet.
   - Bouton « Créer mon compte » désactivé tant que la case n'est pas cochée + message d'erreur explicite à la soumission.
   - Case 2 optionnelle (SMS marketing), séparée visuellement par un bloc distinct et un espacement.
   - Les deux cases décochées par défaut, remises à zéro après inscription.

2. **`src/contexts/AuthContext.tsx`**
   - `signUpWithPhone` accepte les consentements et, après succès de la création de compte, enregistre les deux lignes de consentement.

3. **`src/lib/consent.ts`** (nouveau)
   - Constante de version des documents (`v1.0-2026-08`), types de consentement, helper d'enregistrement et de lecture du dernier état SMS.

4. **`supabase/functions/record-consent/index.ts`** (nouvelle edge function)
   - Valide le jeton de l'utilisateur connecté, déduit le `client_id` du jeton (jamais du corps de requête), récupère l'adresse IP côté serveur (`x-forwarded-for`) et insère les lignes de consentement. Si l'IP est indisponible, le champ reste vide.

5. **`src/pages/ProfilePage.tsx`**
   - Nouvelle section « Mes préférences de communication » : état actuel de l'inscription aux SMS promotionnels + interrupteur. Chaque changement crée une **nouvelle** ligne dans `consentements` (historisation, jamais de mise à jour).

6. **Migration base de données** — table `consentements` : `client_id`, `type_consentement`, `accepte`, `version_document`, `date_consentement`, `adresse_ip`. RLS activée, lecture limitée au propriétaire, insertion limitée au propriétaire (et service role pour l'edge function), aucune modification ni suppression possible côté client.

## Point à valider

Les pages légales existantes sont accessibles sur `/cgv` et `/confidentialite`. La demande mentionne `/politique-confidentialite` : je pointerai vers `/confidentialite` (route existante) sauf indication contraire.

## Note technique

L'IP est récupérée uniquement côté serveur via l'edge function ; en cas d'échec de celle-ci, l'inscription reste valide et les consentements sont écrits directement depuis le client avec IP vide (le compte n'est jamais bloqué par cette étape).
