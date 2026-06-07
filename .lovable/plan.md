# Réparer la zone de livraison < 12 km (distance routière)

## Cause racine identifiée
Le secret `GOOGLE_MAPS_API_KEY` est invalide : sa valeur est une adresse (« 1 place Carnot… »), pas une clé API Google. Tous les appels échouent donc :
- `check-delivery-zone` (géocodage + distance) → erreur, vérification impossible.
- `get-maps-api-key` → renvoie une fausse clé → la carte et l'autocomplétion d'adresse ne se chargent pas.

## Approche
Plutôt que de redemander une clé manuelle (fragile, APIs Google « legacy » dépréciées), on branche le **connecteur Google Maps Platform** (déjà disponible dans l'espace de travail). Il gère la clé et le renouvellement automatiquement, et donne accès aux API non dépréciées (Geocoding + Routes API). On garde la distance **routière**.

## Étapes

### 1. Brancher le connecteur Google Maps Platform
Lier la connexion existante au projet. Cela injecte automatiquement :
- côté serveur (edge functions) : `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY` (clé de passerelle) pour appeler la gateway ;
- côté navigateur : `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` (clé restreinte, sûre dans le HTML) + `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`.

### 2. Réécrire `check-delivery-zone` (distance routière via la gateway)
- Conserver l'auth (Bearer + `getUser`) et la validation d'entrée (longueur adresse, `restaurantId` valide).
- Géocoder l'adresse via la gateway : `GET {GATEWAY}/maps/api/geocode/json?address=...` avec en-têtes `Authorization: Bearer ${LOVABLE_API_KEY}` et `X-Connection-Api-Key: ${GOOGLE_MAPS_API_KEY}`.
- Calculer la distance **routière** via **Routes API** (Distance Matrix legacy supprimée) : `POST {GATEWAY}/routes/distanceMatrix/v2:computeRouteMatrix` avec origine = restaurant, destination = adresse géocodée, `travelMode: DRIVE`, en-tête `X-Goog-FieldMask: originIndex,destinationIndex,distanceMeters,duration,condition`.
- Calculer `distanceKm`, `isInZone = distanceKm <= 12`, et renvoyer `distanceText`/`durationText` formatés, `coordinates`, `postalCode`, `addressFormatted` (mêmes champs qu'aujourd'hui, pour ne rien casser côté front).
- Gestion d'erreur robuste : renvoyer un JSON `{ isInZone:false, error, distanceKm:null }` en 200 sur échec géocodage/route (pas de 500 qui casse le front).

### 3. Charger la carte et l'autocomplétion avec la clé navigateur du connecteur
- `DeliveryZoneMap.tsx` et `AddressAutocomplete.tsx` : remplacer l'appel à l'edge function `get-maps-api-key` par l'usage direct de `import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` pour initialiser le loader Google Maps. Conserver les états chargement/erreur/réessai déjà en place.

### 4. Nettoyage
- Supprimer la fonction `get-maps-api-key` devenue inutile (la clé navigateur vient désormais d'une variable d'environnement publique, plus besoin d'un endpoint protégé).

### 5. Vérification
- Tester `check-delivery-zone` via la passerelle d'edge functions avec une adresse dans la zone et une hors zone (> 12 km) pour confirmer `isInZone` correct et la distance routière.
- Vérifier dans l'aperçu que la carte s'affiche, que l'autocomplétion fonctionne et que le badge « Dans la zone / Hors zone » est cohérent.

## Détails techniques
- Gateway URL : `https://connector-gateway.lovable.dev/google_maps`.
- Routes API attend des coordonnées (lat/lng) → on géocode d'abord l'adresse client, le restaurant a déjà ses coordonnées en dur.
- Aucune modification de base de données ni d'authentification applicative.
- Coordonnées restaurants conservées : Conches `48.9592, 0.9416`, Beaumont `49.0825, 0.7769`.

## Fichiers concernés
- `supabase/functions/check-delivery-zone/index.ts` (réécriture des appels Google)
- `src/components/DeliveryZoneMap.tsx` (clé navigateur)
- `src/components/AddressAutocomplete.tsx` (clé navigateur)
- `supabase/functions/get-maps-api-key/index.ts` (suppression)
