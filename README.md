# Trail-côtes

Application pour traileurs et coureurs en France : trouver des côtes et des descentes près de chez
soi (pentes mesurées sur les altitudes IGN), composer une sortie ou une séance, préparer une course
(plan d'entraînement, temps de passage, nutrition) et trouver les courses à venir.

**Essayer l'appli** : https://trail-cotes.pages.dev (à ajouter sur l'écran d'accueil du téléphone :
Partager → « Sur l'écran d'accueil »). Elle est republiée automatiquement à chaque changement.

## Ce que fait l'appli

| Écran | Fonctions |
|---|---|
| Côtes et descentes | recherche par critères en plages (pente, passage le plus raide, longueur, D+, distance, sol, voie, routes passantes), tri, 3 / 5 / 10 meilleures ou toutes, carte ou liste, détail avec pente tous les 50 m, export GPX |
| S'entraîner | séance du coach (« 8 × 400 m à 10 % » → où la faire), sortie sur mesure (durée ou distance, relief, boucle sur le réseau des chemins, GPX), mes progrès |
| Course | trouver sa course (nom, format ou GPX), questionnaire, plan semaine par semaine, profil, temps de passage, prépa près de chez soi |
| Nutrition | glucides, eau et sel par heure et par ravitaillement, expliqués (ACSM, ISSN) |
| Courses à venir | courses à pied en France par ville, département ou région, filtres et carte (DATAtourisme, OpenAgenda) |
| Mes courses, Profil | calendrier de l'année, budget ; avatar, sorties GPX, points |

Couverture actuelle : Rennes Métropole et Nantes Métropole (côtes et réseau des boucles). Les
zones se calculent sur GitHub ; pour en ajouter une, l'écrire dans `scripts/zones.json`.

## Organisation du dépôt

```
app/                    application Expo (iOS, Android, web), voir app/README.md
  src/calcul/           calculs testés sans réseau (côtes, boucles, séances, plan, nutrition, agenda…)
  src/ecrans/           un fichier par écran ; src/composants/ : éléments partagés (carte, curseurs…)
  assets/data/          données précalculées : côtes, réseau par zone, communes, courses à venir
trailcotes/             code Python partagé : IGN (altitudes), BD TOPO, profils, OSM, géométrie
scripts/                calculs lancés par GitHub Actions (précalcul des côtes, réseau, courses…)
tests/                  tests Python sans réseau (pytest -q)
resultats/              sorties des calculs (bases SQLite, rapports JSON avec réponses brutes)
docs/feuille-de-route.md  état du projet et ce qu'il reste à faire (dont ce qui revient à Florian)
CLAUDE.md               règles de travail du projet
```

## Développer

```bash
cd app && npm install
npx expo start            # « w » : navigateur, « i » / « a » : téléphone
npm test                  # calculs
npm run typecheck         # types (TypeScript strict)
npm run lint              # style et règles (ESLint)
npm run build:web         # version web installable dans app/dist

pip install -r requirements.txt && pytest -q   # côté Python
node scripts/audit_boutons.js <url>            # clique chaque bouton de chaque écran (Playwright)
```

## Automatismes GitHub (Actions)

| Workflow | Rôle |
|---|---|
| Application (tests) | tests, types, ESLint, expo-doctor, compilation web à chaque changement de l'appli |
| Appli web en ligne | publie la version web sur Cloudflare Pages (secret `CLOUDFLARE_API_TOKEN`) |
| Appli Android à installer | fabrique l'APK de test (release « apk ») |
| Précalcul des côtes | calcule les côtes des zones de `scripts/zones.json` (API IGN) |
| Réseau pour les boucles | réseau des chemins de chaque zone (BD TOPO + altitudes) |
| Calendrier des courses | courses à venir, chaque lundi (DATAtourisme, OpenAgenda) |
| Communes, Tuiles, Côtes Rennes | recherche de ville hors ligne, carte hors ligne, validation des services IGN |
| EAS | versions pour les stores (comptes Apple / Google à créer) |

## Détails techniques des calculs

### Script `cotes_rennes.py`

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

### Script `cotes_bdtopo.py` : les vraies côtes

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

### Validation sur des montées de référence

Faute de côtes relevées sur le terrain, `valider_cotes.py` compare le calcul aux chiffres publiés
de deux ascensions connues (Mont Ventoux par Bédoin : 21,5 km, 1 610 m, 7,5 % ; Alpe d'Huez :
13,8 km, 1 120 m, 8,1 %). Il suit la route BD TOPO au plus court entre départ et arrivée, calcule
le profil IGN et signale « à examiner » au-delà de 5 % d'écart sur la longueur ou le dénivelé.
Il mesure aussi le débit de l'API altimétrique (GET / POST, lots de 150 à 5 000 points).

### Segmentation GPX et plan nutrition

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

### Précalcul à l'échelle d'un département

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

### GitHub Actions

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

Voir `docs/feuille-de-route.md` : ce qui est fait, ce qui limite encore, et ce que Florian doit
faire (comptes développeur, stores, partenariats, secrets).

## Licences des données

Altitudes RGE ALTI et BD TOPO : IGN, Licence Ouverte Etalab 2.0. Mentionner « Source : IGN » dans l'application.

Revêtements : OpenStreetMap, licence ODbL. Mention obligatoire « © contributeurs OpenStreetMap ».
Si l'application diffuse une base de côtes enrichie par OSM, cette base doit elle aussi être
publiée sous ODbL (partage à l'identique) ; les champs issus d'OSM sont isolés
(`surface_osm`, `technicite`, `revetement` quand `source_revetement` commence par « OSM ») pour
pouvoir les retirer si besoin.

Courses à venir : DATAtourisme (ADN Tourisme) et OpenAgenda, Licence Ouverte 2.0 ; le producteur
et la date de mise à jour de chaque course sont affichés dans l'appli.
