# Verrouiller les limites Super Admin côté serveur

## Constat (vérifié en base)

- La table `admin_phones` est **déjà** protégée : le trigger `enforce_admin_phone_limits_trigger` (BEFORE INSERT OR UPDATE) rejette un 2e `super_admin` et un 3e `secondary_super_admin`, avec exactement les mêmes messages que l'UI.
- La faille restante est sur **`user_roles`** : la policy `Super admin can manage all roles` (ALL, `is_super_admin(auth.uid())`) autorise un super admin à insérer directement un rôle `super_admin` ou `secondary_super_admin` sans passer par `admin_phones`. Aucun trigger ne contrôle les limites sur cette table.
- Le trigger `sync_admin_phone_user_role_trigger` synchronise `admin_phones` → `user_roles`, donc la voie légitime reste intacte.

## Correctif proposé (approche 1 : contrainte base de données)

Une migration additive, sans changement d'UI ni de comportement :

1. Nouvelle fonction `public.enforce_user_role_limits()` (trigger BEFORE INSERT OR UPDATE sur `public.user_roles`, SECURITY DEFINER, `search_path = public`) :
   - si `NEW.role = 'super_admin'` : rejette si un autre utilisateur possède déjà ce rôle (max 1) ;
   - si `NEW.role = 'secondary_super_admin'` : rejette au-delà de 2 ;
   - messages d'erreur identiques à ceux déjà affichés par l'UI ;
   - idempotent : un `upsert` sur une ligne existante (même `user_id` + même rôle) ne déclenche pas d'erreur, pour ne pas casser `assignRole`, `toggleAdminActive` ni la resynchronisation faite par `assign-admin-role`.
2. Attacher le trigger `enforce_user_role_limits_trigger` à `public.user_roles`.

La vérification JS dans `assignRole` reste en place comme simple raccourci UX.

## Test

Ajout dans `supabase/functions/rls-tests/rls_test.ts` d'un test (ignoré sans clé service role) qui, en contournant l'UI :

- tente d'insérer un 2e `super_admin` via `admin_phones` puis via `user_roles` → doit échouer dans les deux cas ;
- tente un 3e `secondary_super_admin` de la même façon → doit échouer ;
- vérifie qu'un rôle non concerné (ex. `secondary_admin_conches`) s'attribue toujours normalement (non-régression).

Nettoyage systématique des lignes/utilisateurs créés en fin de test.

## Portée

Aucun autre fichier modifié : une migration SQL + le fichier de tests. `AdminContext.tsx` reste inchangé.
