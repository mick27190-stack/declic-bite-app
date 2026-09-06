# Optimisation de la taille du logo intégré aux factures PDF

## Contexte
Dans `src/lib/sendInvoice.ts`, le logo de l'entreprise est récupéré depuis le bucket `company-logos` puis converti en data URL brute via `FileReader`, sans aucun redimensionnement ni compression. Or ce logo n'est affiché qu'à 22 mm dans le PDF (`logoSize = 22` dans `src/lib/invoicePdf.ts`). Résultat : les factures PDF atteignent jusqu'à 4,7 Mo et gonflent inutilement le bucket `invoices`.

## Changements

### 1. `src/lib/imageResize.ts` — nouvelle fonction `blobToCompressedDataUrl`
Ajouter une fonction `blobToCompressedDataUrl(blob: Blob, maxSize = 800, quality = 0.75): Promise<string>` qui reproduit exactement le traitement de `fileToCompressedDataUrl` (lecture en data URL → chargement dans une `HTMLImageElement` → redimensionnement par canvas → export JPEG avec ratio de qualité), mais en acceptant un `Blob` en entrée au lieu d'un `File`. Le corps peut réutiliser la même logique (FileReader fonctionne sur un Blob).

### 2. `src/lib/sendInvoice.ts` — remplacer la conversion du logo
Remacer le bloc actuel (fetch du signed URL → `res.blob()` → `FileReader.readAsDataURL`) par :
```ts
const b = await res.blob();
logoDataUrl = await blobToCompressedDataUrl(b, 200, 0.8);
```
Import de `blobToCompressedDataUrl` depuis `@/lib/imageResize`. Paramètres : `maxSize = 200` (suffisant pour un logo à 22 mm en A4), `quality = 0.8`. Le `try/catch` existant et le fallback `logoDataUrl = null` sont conservés inchangés.

## Non-modifié (explicitement)
- Mise en page du PDF (`src/lib/invoicePdf.ts`) — `logoSize`, format, positionnement.
- Flux Stripe, logique de facturation, numérotation, envoi mail, upsert Storage/DB.
- `fileToCompressedDataUrl` inchangé (utilisé ailleurs pour les fiches produit).

## Validation
- `bunx tsc --noEmit` (typecheck).
- Génération d'une facture de test via le parcours existant et vérification de la taille du PDF (devrait chuter de ~4,7 Mo à quelques dizaines de Ko).
