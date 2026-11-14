# Carte « Nos distributeurs Distri'Declic Pizza » + page dédiée

## Page de sélection du site
- Remplacer le logo « Conches » de la carte distributeur par le nouveau logo généraliste Distri'Déclic Pizza (fond blanc retiré, même taille ~80 px).
- Titre de la carte : « Nos distributeurs Distri'Declic Pizza ».
- Sous-titre court conservé (ex. « Disponibles 24h/24 »), icône flèche remplacée par un chevron.
- Le toucher de la carte ouvre la nouvelle page `/distributeurs` (plus d'ouverture directe de l'app).

## Nouvelle page « Nos distributeurs »
- Bouton Retour, titre, grand logo généraliste.
- Une carte : la carte Conches actuelle (logo Conches, « Distributeur Déclic Pizza - Conches », Disponible 24h/24 • Commandez en ligne), avec exactement le comportement actuel : iPhone → App Store Smart Pizza, Android → app/Google Play, ordinateur → site Smart Machine.
- Structure prête pour ajouter d'autres distributeurs plus tard.

## Technique
- Logo importé via lovable-assets (détouré).
- Nouvelle page `src/pages/DistributeursPage.tsx` + route dans App.tsx ; logique de redirection déplacée depuis LandingPage.tsx sans changement.
- Rien d'autre modifié.
