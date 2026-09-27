# Activation automatique des alertes sonores (admins de site)

## Limite importante
Les navigateurs (Safari/iPhone, Chrome) interdisent tout son tant que la personne n'a pas touché l'écran au moins une fois. Aucune app web ne peut contourner cette règle. On peut en revanche supprimer le bouton : **le premier toucher n'importe où dans l'app** (menu, profil, défilement…) active les alertes, sans appui dédié.

## Ce qui change
- Pour un compte admin (super admin, admin de site, admin secondaire) connecté, les alertes s'activent toutes seules au premier toucher/clic ou à la première touche clavier, sur n'importe quelle page.
- Cette activation automatique ne se fait que pendant les heures d'ouverture du site concerné, telles que définies dans Paramètres > horaires (2 plages par jour, par site). Si aucun horaire n'est défini pour le jour, on utilise 18h–22h.
- Le bouton « Activer les alertes sonores » disparaît. Il ne s'affiche plus que dans un cas : une commande arrive alors que personne n'a encore touché l'écran — le bandeau rouge « J'ai vu » s'affiche alors avec un petit lien « Activer le son ».
- Après verrouillage du téléphone ou passage en arrière-plan, le son se réactive tout seul au prochain toucher.
- Hors heures d'ouverture : aucune activation automatique ; les commandes éventuelles déclenchent toujours le bandeau rouge (son activable via le lien).

## Détails techniques
- `NewOrderAlarm.tsx` : écouteurs globaux `pointerdown`/`touchstart`/`keydown` (capture, passifs) qui appellent `initNotificationSounds()` si `active` et si au moins un site autorisé est dans sa fenêtre d'ouverture ; retirés une fois l'audio déverrouillé, réinstallés quand `isAudioUnlocked()` redevient faux.
- Fenêtre d'ouverture : lecture de `site_opening_hours` (heure de Paris, jour courant, slot1/slot2) pour les sites de l'admin, réévaluée chaque minute ; repli 18h–22h.
- Suppression du bouton flottant ; ajout d'un bouton « Activer le son » dans le bandeau rouge quand `!unlocked`.
- Vérification Playwright : compte admin, premier clic sur la page → audio déverrouillé, plus de bouton affiché.
