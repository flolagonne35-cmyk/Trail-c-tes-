# Maquette → données à produire

Maquette (4 écrans, mobile 390×844) : https://claude.ai/artifact/MU9jPStx1URh9ZusPGLrWf

Ce que chaque écran affiche, et donc ce que le calcul doit sortir.

## Parcours segmenté

| Affiché | Champ | Calcul |
|---|---|---|
| Nom, distance totale | `nom`, `distance_km` | GPX |
| D+, D−, altitude max | `dplus_m`, `dmoins_m`, `alt_max_m` | profil IGN lissé |
| Profil coloré montée / descente / plat | `profil[]` (distance, altitude, type) | segmentation |
| Segment : type, km début – fin, D± , pente moyenne | `segments[]` : `type`, `km_debut`, `km_fin`, `denivele_m`, `pente_moy_pct`, `pente_max_pct`, `difficulte` | segmentation |
| Description (« Régulière, roulante », « Technique… ») | `description` | à générer à partir de pente moyenne / max et de leur variabilité ; la nature du sol (racines, cailloux) n'est pas dans le MNT → BD TOPO (nature du tronçon) ou saisie |

## Nutrition

| Affiché | Champ | Calcul |
|---|---|---|
| Objectif de temps | `objectif_h` | saisie |
| Glucides / eau / sodium par heure | `glucides_g_h`, `eau_ml_h`, `sodium_mg_h` | préférences, ajustables |
| Tronçon entre ravitos : noms, km, heure de passage estimée | `troncons[]` : `de`, `a`, `km_debut`, `km_fin`, `passage_h` | ravitos saisis ; temps par segment (modèle d'allure selon la pente) recalé sur l'objectif |
| Quantités (gels, eau, pastilles) | `quantites` | durée du tronçon × besoins horaires, arrondis en unités |

## Côtes à proximité

| Affiché | Champ | Calcul |
|---|---|---|
| Rayon, position | `rayon_m`, `lat`, `lon` | géolocalisation accrochée au chemin le plus proche |
| Filtres : pente mini, chemin / route | `pente_min_pct`, `nature` | BD TOPO (`nature` du tronçon) |
| Carte avec côtes numérotées | `geometrie` (ligne) | tronçon BD TOPO |
| « 500 m à 10 % », +50 m, nature, max 14 % | `longueur_m`, `pente_moy_pct`, `dplus_m`, `nature`, `pente_max_pct` | **côte = portion de tronçon**, pas une zone |
| Distance « de toi » | `distance_m` | distance au départ de la côte (à vol d'oiseau d'abord, par les chemins ensuite) |

## Détail d'une côte

| Affiché | Champ | Calcul |
|---|---|---|
| D+, pente max, rythme estimé | `dplus_m`, `pente_max_pct`, `duree_estimee_s` | profil ; allure en côte de l'utilisateur |
| Profil avec section > 12 % | `profil[]` tous les 10 m | altitudes IGN le long du tronçon, lissées |
| Pente tous les 50 m | `pentes_50m[]` | moyenne par tranche de 50 m |
| Y aller / Envoyer à la montre | export GPX de la côte | — |

## Conséquence pour le script

`cotes_rennes.py` sort aujourd'hui des **zones** (surfaces de la grille où la pente dépasse un seuil).
Les écrans Côtes et Détail attendent des **côtes linéaires** : longueur, pente moyenne et max, D+,
nature du chemin, profil tous les 50 m. D'où l'étape 4 : partir des tronçons BD TOPO, les
échantillonner tous les 10 m, interroger l'IGN sur ces points (bien moins de points que la
grille), lisser le profil, puis découper les portions montantes. La grille reste utile pour
présélectionner les secteurs où chercher.
