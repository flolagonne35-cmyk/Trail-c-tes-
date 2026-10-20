# Trail-côtes

Application mobile pour traileurs et coureurs en France : analyser un parcours GPX et trouver
les côtes proches, à partir des altitudes précises de l'IGN (RGE ALTI, 1 m à 5 m selon les zones).

MVP visé, trois fonctions :

1. **Segmentation de parcours** : import GPX, altitudes recalculées et lissées, segments
   montée / descente / plat (distance, D+, pente moyenne et max, difficulté).
2. **Plan nutrition** : eau, glucides et sodium par tronçon entre ravitaillements.
3. **Côtes à proximité** : liste et carte des côtes autour de l'utilisateur, filtres, profil
   de pente tous les 50 m.

Pas de scraping, pas de synchronisation Garmin (API fermée) : les parcours arrivent en GPX.

## Structure du dépôt

```
scripts/cotes_rennes.py           grille autour d'un point → altitudes IGN → lissage → pente → zones pentues
tests/                            tests sans réseau (relief fictif, formats de réponse de l'API)
resultats/rennes/                 sorties du dernier run GitHub Actions (CSV, PNG, rapport JSON)
.github/workflows/cotes-rennes.yml  run automatique sur Rennes + signalement des erreurs
docs/maquette.md                  champs attendus par chaque écran de la maquette
requirements.txt
```

Maquette des 4 écrans : https://claude.ai/artifact/MU9jPStx1URh9ZusPGLrWf

Plus tard : `trailcotes/` (paquet Python partagé : altitudes, lissage, segmentation, accrochage
aux chemins), puis l'application mobile.

## Script `cotes_rennes.py`

```bash
pip install -r requirements.txt
python scripts/cotes_rennes.py                       # Rennes, carré de 2 km de demi-côté, pas 20 m
python scripts/cotes_rennes.py --lat 45.92 --lon 6.87 --rayon 1500 --pente-min 15
python scripts/cotes_rennes.py --demo                # relief fictif, sans réseau
pytest -q
```

Sorties dans `--sortie` (défaut `resultats/rennes/`) :

| Fichier        | Contenu |
|----------------|---------|
| `grille.csv`   | `lat, lon, z_brut_m, z_lisse_m, pente_pct` pour chaque point |
| `zones.csv`    | une zone pentue par ligne : centre, surface, pente moyenne et max, altitudes, dénivelé, étendue |
| `carte.png`    | ombrage, pente en couleur, contours numérotés des 15 premières zones |
| `rapport.json` | paramètres, statistiques, codes HTTP, précisions (`acc`) et erreurs renvoyées par l'API |

Code de sortie : `0` OK, `2` trop de points sans altitude (`--max-echec`, 5 % par défaut), `1` plantage.

### Méthode

- **Grille** : projection équirectangulaire locale autour du centre (erreur négligeable sur quelques km).
- **Altitudes** : `GET https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json`
  avec `lon`, `lat` (séparés par `|`), `resource=ign_rge_alti_wld`, `zonly=false` pour récupérer
  la précision `acc` de chaque point. Lots de 150 points, 0,25 s entre requêtes, réessais avec
  attente exponentielle sur 429 / 5xx. La valeur `-99999` (hors couverture) devient « sans donnée ».
- **Lissage** : gaussienne normalisée (σ = 30 m par défaut) qui ignore les points sans donnée.
- **Pente** : norme du gradient (différences finies), en %.
- **Zones pentues** : composantes connexes (8-voisinage) au-dessus du seuil, surface ≥ 2000 m²,
  triées par dénivelé.

### À vérifier sur l'API réelle (étape 3)

Ces points viennent de la documentation IGN et seront confirmés par le premier run :

- taille maximale d'un lot et longueur d'URL acceptée (passer en `POST` si besoin) ;
- limite de débit (requêtes/seconde) ;
- format exact de `elevations` et des valeurs `acc` ;
- comportement hors couverture et sur l'eau (Vilaine, étangs).

Le `rapport.json` garde un extrait de réponse brute pour faire ces corrections.

## GitHub Actions

Le workflow **Côtes Rennes (API IGN)** se lance à la main (onglet *Actions* → *Run workflow*,
avec rayon, pas et seuil réglables), à chaque modification du script, et le 1er de chaque mois.
Il :

1. lance les tests hors réseau ;
2. exécute le script sur Rennes ;
3. écrit un résumé (points valides, codes HTTP, exemple de réponse brute) et des annotations ;
4. commite `resultats/rennes/` sur la branche courante, même en cas d'échec (le rapport sert au diagnostic) ;
5. en cas d'échec, ouvre une issue « Erreur API IGN — côtes Rennes » ou la complète.

## Feuille de route

1. ✅ Script + README.
2. ✅ Workflow Rennes avec résultats versionnés et signalement des erreurs.
3. Corriger le script d'après les réponses réelles de l'API (taille de lot, débit, `acc`, nodata).
4. Accrocher les zones pentues aux tronçons BD TOPO (`troncon_de_route`, chemins et sentiers) :
   échantillonner chaque tronçon tous les 10 m, calculer le profil lissé, découper en côtes
   (longueur, pente moyenne et max, D+), filtrer chemin / route.
5. Segmentation GPX, puis plan nutrition, puis l'application mobile.

## Licences des données

Altitudes RGE ALTI et BD TOPO : IGN, Licence Ouverte Etalab 2.0. Mentionner « Source : IGN » dans l'application.
