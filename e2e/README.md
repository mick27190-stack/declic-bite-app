# Tests E2E — Déclic Pizza

Tests Playwright bout-en-bout. Le premier scénario couvre la synchronisation
du site préféré entre le profil client et la fiche admin (`customers.site`).

## Prérequis

1. Installer le navigateur Chromium de Playwright (une seule fois) :
   ```bash
   bunx playwright install chromium
   ```
2. Lancer le serveur de dev :
   ```bash
   bun run dev
   ```
3. Se connecter dans le preview Lovable avec un compte **client** — la
   session Supabase est alors injectée dans l'environnement via :
   - `LOVABLE_BROWSER_SUPABASE_STORAGE_KEY`
   - `LOVABLE_BROWSER_SUPABASE_SESSION_JSON`
   - `LOVABLE_BROWSER_SUPABASE_COOKIES_JSON`
4. Exposer les identifiants Supabase pour la vérification côté serveur
   (contournement RLS pour lire la fiche `customers`) :
   ```bash
   export E2E_SUPABASE_URL="https://<ref>.supabase.co"
   export E2E_SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"
   ```
   À défaut, la clé anon est utilisée et le test dépend des RLS actives.

## Lancer les tests

```bash
bunx playwright test
```

Filtrer un fichier précis :

```bash
bunx playwright test e2e/profile-site-sync.spec.ts
```

## Scénarios

- `profile-site-sync.spec.ts` — bascule le site depuis `/profile` et
  vérifie que `profiles.preferred_restaurant` **et** `customers.site` sont
  mis à jour (contrat du trigger `sync_customer_from_profile`).
