# Trail-côtes — application

Application Expo (React Native, TypeScript) : côtes à proximité mesurées sur les altitudes IGN,
préparation de course (profil, temps de passage, nutrition), avatar et points.

```bash
cd app
npm install
npx expo start          # puis « i », « a » ou « w » (iOS, Android, navigateur)
npm test                # calculs, comparés aux résultats des scripts Python
npm run typecheck
```

## Organisation

En bas, cinq onglets ; en haut à gauche, le menu ☰ qui range **toutes** les sections par
catégorie ; en haut à droite, l'avatar ouvre le profil.

| Catégorie | Section | Ce qu'on y fait |
|---|---|---|
| — | **Accueil** (onglet) | coureur, points, semaine ; accès à tout, rangé par catégorie ; côtes proches |
| Explorer | **Côtes** (onglet) | point de départ (GPS, ville, adresse), Montées / Descentes, filtres en plages min–max (pente, passage le plus raide, longueur, D+, distance), sol, voie, routes passantes ; tri croissant ou décroissant ; carte ou liste, carte hors ligne |
| S'entraîner | **S'entraîner** (onglet) | *Séance* (« 8 × 400 m à 10 % » → 3 endroits), *Boucle* (distance, côtes, D+, sans route → GPX), *Mes progrès* (chronos par côte, allure selon la pente) |
| Courses | **Course** (onglet) | GPX de la course : *Profil*, *Passages* (à mon allure si connue), *Prépa* (côtes équivalentes près de chez moi) |
| Courses | **Nutrition** (onglet) | pour la course chargée (plan par ravito) ou pour une simple durée ; tout est expliqué et sourcé |
| Courses | **Mes courses** (menu) | calendrier de l'année, statut, dossard et logement, budget, compte à rebours, « Préparer » |
| Moi | **Profil** (menu, avatar) | avatar, points, sorties GPX ou capture, classement |
| Infos | **Données et confidentialité** (menu) | sources des chiffres, ce qui reste sur le téléphone |

Le **détail d'une côte** : adresse et GPS du départ, trafic, trajets, profil, pente tous les
50 m, mes passages chronométrés, séance de répétitions, export GPX.

Au premier lancement : présentation, puis création du coureur — silhouette, corpulence, taille,
peau, yeux (forme et couleur), sourcils, expression, barbe, taches de rousseur, coupe et couleur
de cheveux, haut / bas / chaussures et leurs couleurs, casquette / bandeau / buff / bonnet,
gilet d'hydratation ou ceinture, lunettes, montre, bâtons, dossard. Tout est facultatif
(« Au hasard » ou « Plus tard ») et modifiable ensuite depuis le Profil.

Services utilisés depuis le téléphone (publics, sans clé) : géocodage `data.geopf.fr/geocodage`
et itinéraires `data.geopf.fr/navigation/itineraire`. Leur format est vérifié à chaque passage
du workflow (`scripts/verifier_services.py`). S'ils ne répondent pas, les temps sont estimés
depuis la distance (marqués « ≈ »).

## Données

`assets/data/cotes.json` et `assets/data/parcours_demo.json` sont produits par
`python scripts/exporter_app.py` (à la racine du dépôt) à partir des résultats des scripts
(`resultats/`). Pour l'instant : Rennes Métropole (848 côtes), Nantes Métropole dont Couëron (1 470 côtes) et un parcours de démonstration.

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

## Côtes de toute la France

Les côtes de chaque département sont calculées sur GitHub (workflow « Précalcul des côtes
(France) ») et servies avec la version web, dans `/cotes/` (un fichier par département et un
`index.json`). L'appli charge les départements à moins de 40 km du point de départ
(`src/cotesFrance.ts`) ; Rennes et Nantes restent embarquées pour le hors-ligne.

