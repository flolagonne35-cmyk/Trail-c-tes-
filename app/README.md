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
- **Côtes** : position du téléphone (Rennes par défaut si la localisation est refusée), filtres
  pente, type de voie et rayon, carte schématique, liste triée par distance.
- **Détail** : profil, pente tous les 50 m, temps estimé, itinéraire (Plans, Google Maps ou
  OpenStreetMap), export GPX vers l'application de la montre.

## Données

`assets/data/cotes.json` et `assets/data/parcours_demo.json` sont produits par
`python scripts/exporter_app.py` (à la racine du dépôt) à partir des résultats des scripts
(`resultats/`). Pour l'instant : la zone de Rennes et un parcours de démonstration.

## Code

- `src/calcul/` : calculs sans interface, portés des scripts Python (`trailcotes/`, `scripts/`) ;
  `calcul.test.ts` vérifie qu'ils donnent les mêmes résultats sur la même trace.
- `src/ecrans/`, `src/composants/` : interface.
- Versions des paquets : celles d'Expo SDK 58 (`node_modules/expo/bundledNativeModules.json`).
