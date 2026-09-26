# Conformité RGPD : cookies + allergènes

Rien d'existant n'est modifié : la fenêtre de consentement à l'inscription, Stripe, la fidélité, les notifications et l'admin restent tels quels.

## 1. Bannière cookies
- Un bandeau en bas de l'écran à la première visite, seulement si aucun choix n'est déjà enregistré (`cookie_consent`). Il affiche le titre « 🍪 Gestion des cookies », le texte fourni et trois boutons : Tout accepter, Tout refuser, Personnaliser.
- Le panneau Personnaliser propose :
  - Cookies essentiels : toujours actifs, non désactivables.
  - Mesure d'audience : interrupteur oui/non.
  - Un bouton « Enregistrer mes choix ».
- Le choix est enregistré sur l'appareil au format `{ essentiels: true, analytics, date }`.
- Mesure d'audience : aucun script Google Analytics n'est aujourd'hui chargé par le site. Je prépare un point unique qui ne chargera les outils d'audience qu'après votre accord. L'outil d'analyse de la plateforme est ajouté par l'hébergement, en dehors du code du site : je ne peux pas le bloquer. La politique de cookies le mentionnera.
- Un lien « Gérer mes cookies » est ajouté en bas de page, à côté des liens légaux. Il rouvre le panneau avec vos choix actuels déjà cochés.
- Nouvelle page `/politique-cookies`, avec la même présentation que les CGV.

## 2. Allergènes
- Base de données : ajout d'un champ « allergènes » (liste) sur les fiches produits modifiables de l'admin. Aucun champ existant n'est touché. Les 14 allergènes réglementaires sont proposés.
- Fiche pizza : une ligne discrète « Allergènes : … » s'affiche sous les ingrédients. Si aucun allergène n'est coché, rien ne s'affiche.
- Nouvelle page `/allergenes` avec le texte fourni. Elle est accessible depuis le bas de page et depuis le menu.
- Admin menu : des cases à cocher pour les allergènes, à la création comme à la modification d'un produit. Les autres champs restent inchangés.

## Vérification
Après les modifications, je vérifie que le site se construit sans erreur. Je vérifie aussi à l'écran le bandeau cookies, la fiche pizza et l'enregistrement des allergènes dans l'admin, puis je contrôle que le panier et le paiement ne changent pas.

## Détails techniques
- Migration : `ALTER TABLE menu_item_overrides ADD COLUMN allergenes text[] NOT NULL DEFAULT '{}'`.
- `useMenuOverrides` expose `allergenes`. Les fichiers modifiés sont `PizzaDetailModal` et `AdminMenuPage`.
- `src/lib/cookieConsent.ts` (lecture, écriture, événement de réouverture) et `src/lib/analyticsLoader.ts` (chargement de gtag seulement si `analytics=true`, identifiant à fournir).
- `CookieConsentBanner` est monté dans `App.tsx`. Les deux nouvelles routes sont ajoutées. Les liens sont placés dans `LegalLayout` et dans le bas de page de l'accueil.
