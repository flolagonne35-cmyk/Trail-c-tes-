# Trail-côtes — application

Application Expo (React Native, TypeScript) qui reprend les 4 écrans de la maquette :
parcours segmenté, nutrition et ravitos, côtes à proximité, détail d'une côte.

```bash
cd app
npm install
npx expo start          # puis « i », « a » ou « w » (iOS, Android, navigateur)
npm test                # calculs, comparés aux résultats des scripts Python
npm run typecheck
```

## Ce que fait chaque écran

- **Parcours** : import d'un GPX ; altitudes IGN (RGE ALTI) demandées au service de la
  Géoplateforme, repli sur les altitudes du GPX si le service ne répond pas ; segmentation
  montée / descente / plat avec difficulté et description.
- **Nutrition** : objectif de temps, ravitaillements, glucides / eau / sodium par heure ajustables,
  température ; quantités par tronçon (gels, eau, pastilles) ; partage du plan.
- **Côtes** : « Me localiser » ou recherche d'une ville / d'une adresse (géocodage IGN, avec
  suggestions) ; filtres pente, type de voie et rayon ; carte schématique ; pour chaque côte,
  l'adresse du pied (géocodage inverse) et le temps estimé en voiture et en courant. Sans côte
  dans le rayon, les 5 plus proches sont proposées. Vraie carte Plan IGN (glisser, + / −,
  recentrer) avec les côtes tracées et numérotées ; toucher un numéro ouvre la côte.
- **Détail** : adresse précise et GPS du départ, temps pour y aller en voiture et à pied
  (itinéraires IGN), en courant (à votre allure) et à vélo ; profil, pente tous les 50 m, séance
  de répétitions, ouverture dans l'appli de cartes, export GPX vers la montre.
- **Moi** : avatar, points, sorties (GPX vérifié ou capture en attente), classement.

Services utilisés depuis le téléphone (publics, sans clé) : géocodage `data.geopf.fr/geocodage`
et itinéraires `data.geopf.fr/navigation/itineraire`. Leur format est vérifié à chaque passage
du workflow (`scripts/verifier_services.py`). S'ils ne répondent pas, les temps sont estimés
depuis la distance (marqués « ≈ »).

## Données

`assets/data/cotes.json` et `assets/data/parcours_demo.json` sont produits par
`python scripts/exporter_app.py` (à la racine du dépôt) à partir des résultats des scripts
(`resultats/`). Pour l'instant : la zone de Rennes et un parcours de démonstration.

## Version de test sans réseau

`EXPO_PUBLIC_TUILES_LOCALES=1 npx expo export --platform web` : la carte lit les tuiles dans
`tuiles/<z>/<x>/<y>.png` à côté de la page (zooms 11 à 15, téléchargées par
`scripts/telecharger_tuiles.py`, workflow « Tuiles Plan IGN »). Sans cette variable, les tuiles
viennent en direct du WMTS de la Géoplateforme (jusqu'au zoom 18).

## Code

- `src/calcul/` : calculs sans interface, portés des scripts Python (`trailcotes/`, `scripts/`) ;
  `calcul.test.ts` vérifie qu'ils donnent les mêmes résultats sur la même trace.
- `src/ecrans/`, `src/composants/` : interface.
- Versions des paquets : celles d'Expo SDK 58 (`node_modules/expo/bundledNativeModules.json`).
