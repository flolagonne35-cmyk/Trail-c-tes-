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
trailcotes/                       code partagé : ign (altitudes), bdtopo (réseau), profil, osm, geo, gpx
scripts/cotes_rennes.py           grille autour d'un point → altitudes IGN → lissage → pente → zones pentues
scripts/cotes_bdtopo.py           chemins BD TOPO → profils IGN tous les 10 m → côtes (longueur, pente, D+)
scripts/valider_cotes.py          validation sur des montées de référence (Ventoux, Alpe d'Huez) + débit de l'API
scripts/segmenter_gpx.py          GPX → segments montée / descente / plat (fonctionnalité 1)
scripts/plan_nutrition.py         segments + objectif + ravitos → eau, glucides, sodium par tronçon (fonctionnalité 2)
scripts/precalcul.py              zone découpée en tuiles → base SQLite de côtes, reprise, recherche « côtes proches »
tests/                            tests sans réseau (relief fictif, formats de réponse de l'API)
resultats/rennes/, rennes_cotes/  sorties du dernier run GitHub Actions (CSV, GeoJSON, PNG, rapport JSON)
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

## Script `cotes_bdtopo.py` : les vraies côtes

```bash
python scripts/cotes_bdtopo.py                       # autour du centre de Rennes, rayon 2 km
python scripts/cotes_bdtopo.py --lat 48.08 --lon -1.73 --pente-min 8 --longueur-min 200
python scripts/cotes_bdtopo.py --demo                # réseau et relief fictifs
```

1. **Tronçons** : WFS Géoplateforme, couche `BDTOPO_V3:troncon_de_route`, paginé par 1000.
   Natures retenues : routes à 1 ou 2 chaussées, chemins, routes empierrées, sentiers, pistes
   cyclables (autoroutes, bretelles, ronds-points, escaliers et bacs exclus).
2. **Voies** : les tronçons sont coupés à chaque intersection ; on les raccorde quand ils sont
   du même type et se prolongent (virage ≤ 45°), pour qu'une côte ne s'arrête pas à chaque carrefour.
3. **Profil** : un point tous les 10 m, altitude IGN, lissage gaussien (σ = 20 m). Ponts et tunnels
   (`position_par_rapport_au_sol` ≠ 0) : altitude interpolée, le MNT donnant le sol sous l'ouvrage.
4. **Côtes** : sommets et creux successifs (contre-pente tolérée : 3 m), une descente étant une
   montée dans l'autre sens ; bouts plats rognés, coupure aux replats de plus de 150 m.
   Filtres : ≥ 150 m, pente moyenne ≥ 5 %, D+ ≥ 8 m. Doublons des routes à 2 chaussées retirés.
5. **Position** : accrochée au tronçon le plus proche ; distance à chaque côte **par le réseau**.

Sorties dans `resultats/rennes_cotes/` : `cotes.csv` (une côte par ligne, avec les pentes tous les
50 m), `cotes.geojson` (géométrie + profil tous les 10 m, prêt pour l'écran Détail), `carte.png`,
`rapport.json`.

6. **Accès** : à pied, les sens interdits ne comptent pas (`sens_de_circulation` ignoré). Les
   tronçons `prive = true` ou dont `acces_pieton` est interdit / réservé aux ayants droit sont exclus.
7. **Revêtement et technicité** : la BD TOPO ne décrit pas le sol ; on prend les tags OpenStreetMap
   (`surface`, `tracktype`, `smoothness`, `sac_scale`) des voies OSM à moins de 15 m de la côte,
   via l'API Overpass. Sans tag OSM, repli sur la nature BD TOPO (« goudronné (supposé) »,
   « non revêtu (supposé) »). La colonne `source_revetement` dit d'où vient la valeur.
8. **Fond de carte** : Plan IGN v2 (WMS Géoplateforme) sous la carte PNG ; jamais bloquant.

Options : `--sans-osm`, `--sans-fond`.

Limites restantes : racines et cailloux ne sont décrits que là où OSM a `smoothness` ou
`sac_scale` ; Overpass est une API publique à usage raisonnable, l'application devra utiliser
son propre extrait OSM (Geofabrik) plutôt que l'interroger à chaque requête.

## Validation sur des montées de référence

Faute de côtes relevées sur le terrain, `valider_cotes.py` compare le calcul aux chiffres publiés
de deux ascensions connues (Mont Ventoux par Bédoin : 21,5 km, 1 610 m, 7,5 % ; Alpe d'Huez :
13,8 km, 1 120 m, 8,1 %). Il suit la route BD TOPO au plus court entre départ et arrivée, calcule
le profil IGN et signale « à examiner » au-delà de 5 % d'écart sur la longueur ou le dénivelé.
Il mesure aussi le débit de l'API altimétrique (GET / POST, lots de 150 à 5 000 points).

## Segmentation GPX et plan nutrition

```bash
python scripts/segmenter_gpx.py parcours.gpx --sortie resultats/mon_parcours
python scripts/plan_nutrition.py resultats/mon_parcours/parcours.json --objectif 38h \
    --ravito "31:Les Contamines" --ravito "50:Les Chapieux" --temperature 22
```

- **Segments** : pente sur 200 m glissants ; au-delà de ±3 % montée ou descente, sinon plat ;
  morceaux de moins de 300 m fusionnés avec leur voisin. Pour chaque segment : distance, D+, D−,
  pente moyenne et max (sur 50 m), difficulté (facile → très difficile, relevée pour une montée
  de plus de 600 m ou un passage très raide) et description (« Régulière, raide en fin »).
  Altitudes IGN, repli sur celles du GPX si le service ne répond pas.
- **Nutrition** : temps de passage par le coût énergétique de la course en pente (Minetti 2002 :
  10 % ≈ 1,7 × le plat, −10 % ≈ 0,6 ×), recalé sur l'objectif ; débits horaires réglables
  (70 g de glucides, 500 ml d'eau, 600 mg de sodium par défaut), eau et sodium +10 % par 5 °C
  au-dessus de 15 °C ; conversion en gels, barres, litres et pastilles. Sorties `plan.csv`,
  `plan.json`, `plan.md`.

## Précalcul à l'échelle d'un département

Interroger les services à chaque ouverture de l'application serait trop lent (≈ 3 min pour
4 km × 4 km). `precalcul.py` calcule une zone tuile par tuile (4 km, marge de 500 m pour ne pas
couper les côtes à cheval) et remplit une base SQLite (`trailcotes/base.py`) :

```bash
python scripts/precalcul.py --zone 48.085,-1.715,48.140,-1.640 --base resultats/base/rennes.sqlite
python scripts/precalcul.py --zone ... --max-tuiles 20     # un passage partiel ; relancer pour continuer
python scripts/precalcul.py --cherche 48.1113,-1.68 --rayon 3000 --base resultats/base/rennes.sqlite
```

L'état de chaque tuile est gardé : une tuile en échec est reprise au passage suivant, les doublons
entre tuiles sont écartés. `cotes_proches()` répond en quelques millisecondes (index sur la
position de départ). Workflow « Précalcul des côtes (zone) » : à la main, avec zone, nom et
nombre de tuiles par passage.

Débit mesuré de l'API altimétrique (run du 20/10/2026) : 140 points/s en GET par lots de 150 ;
GET de 400 points refusé (414, URL trop longue) ; POST en formulaire refusé (500). Les essais
GET 300 points, POST JSON et requêtes parallèles sont mesurés à chaque validation.

## GitHub Actions

Le workflow **Côtes Rennes (API IGN)** lance trois jobs en parallèle : `grille`, `bdtopo` et
`validation` (montées de référence, puis segmentation et plan nutrition sur la trace obtenue).
Il se lance à la main (onglet *Actions* → *Run workflow*, avec rayon et seuil réglables), à chaque modification du script, et le 1er de chaque mois.
Il :

1. lance les tests hors réseau ;
2. exécute le script sur Rennes ;
3. écrit un résumé (points valides, codes HTTP, exemple de réponse brute) et des annotations ;
4. commite `resultats/rennes/` sur la branche courante, même en cas d'échec (le rapport sert au diagnostic) ;
5. en cas d'échec, ouvre une issue « Erreur API IGN — côtes Rennes » ou la complète.

## Feuille de route

1. ✅ Script + README.
2. ✅ Workflow Rennes avec résultats versionnés et signalement des erreurs.
3. ✅ API altimétrique vérifiée (run du 20/10/2026) : 270 requêtes de 150 points, 100 % de points
   valides, aucune erreur, ~0,8 s par requête ; `acc` vaut toujours « Variable suivant la source de
   mesure » (inutilisable comme précision).
4. 🚧 `cotes_bdtopo.py` : accrocher les zones pentues aux tronçons BD TOPO (`troncon_de_route`, chemins et sentiers) :
   échantillonner chaque tronçon tous les 10 m, calculer le profil lissé, découper en côtes
   (longueur, pente moyenne et max, D+), filtrer chemin / route.
5. Segmentation GPX, puis plan nutrition, puis l'application mobile.

## Licences des données

Altitudes RGE ALTI et BD TOPO : IGN, Licence Ouverte Etalab 2.0. Mentionner « Source : IGN » dans l'application.

Revêtements : OpenStreetMap, licence ODbL. Mention obligatoire « © contributeurs OpenStreetMap ».
Si l'application diffuse une base de côtes enrichie par OSM, cette base doit elle aussi être
publiée sous ODbL (partage à l'identique) ; les champs issus d'OSM sont isolés
(`surface_osm`, `technicite`, `revetement` quand `source_revetement` commence par « OSM ») pour
pouvoir les retirer si besoin.
