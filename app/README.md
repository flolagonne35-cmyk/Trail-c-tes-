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

Quatre onglets, chacun avec un seul rôle :

- **Accueil** : mon coureur et mes points, les trois actions (trouver une côte, préparer une
  course, ajouter une sortie), les 3 côtes les plus proches, ma semaine.
- **Côtes** : un point de départ (ma position, ou une ville / une adresse), un résumé des filtres
  et un bouton *Filtres* (panneau pente, distance, type de voie, avec le nombre de côtes en direct),
  puis *Carte* (Plan IGN, côtes tracées et numérotées) ou *Liste*. Chaque côte : adresse du pied,
  temps estimé en voiture et en courant.
  - Recherche plein écran : **toutes les communes de France** (35 000, par nom ou code postal,
    sans accents ni réseau — « Coueron » trouve Couëron) ; adresses précises par le géocodage IGN
    quand le réseau répond ; ma position, lieux récents, zones déjà calculées.
  - Hors des zones calculées (côte la plus proche à plus de 30 km), l'écran le dit et propose
    la zone la plus proche au lieu d'une carte vide.
- **Course** : vide tant qu'aucun parcours n'est importé (GPX, ou l'exemple de l'Alpe d'Huez),
  puis trois vues : *Parcours* (profil, montées / descentes / plats), *Passages* (temps estimés selon
  la pente) et *Nutrition* (ravitos, eau, glucides, sodium par tronçon). Altitudes IGN RGE ALTI,
  repli sur celles du GPX si le service ne répond pas.
- **Profil** : avatar, points, ajout d'une sortie (GPX vérifié ou capture en attente), sorties,
  classement, barème.
- **Détail d'une côte** : adresse et GPS du départ, temps pour y aller (itinéraires IGN), profil,
  pente tous les 50 m, séance de répétitions, ouverture dans l'appli de cartes, export GPX.

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
