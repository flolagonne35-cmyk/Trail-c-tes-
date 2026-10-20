# Idées — état et suite

Idées de Florian, de Mathieu et de Théo (20/10/2026), avec ce qui est fait, ce qui reste et les
points de vigilance.

## Fait dans l'application (sans serveur)

| Idée | Où | Remarque |
|---|---|---|
| Avatar à créer en entrant dans l'appli (femme / homme, coupe, couleurs, tenue, casquette, bâtons de trail) | au premier lancement, puis Profil → « Personnaliser » | dessin SVG en couches (corpulence, taille, yeux, tenue, équipement…), tout facultatif |
| Points selon la distance, le dénivelé et les répétitions de côtes | `src/calcul/points.ts` | barème ci-dessous, à ajuster |
| Points seulement après la création du compte | idem | toute sortie datée avant est refusée |
| Preuve par capture Strava / Garmin | onglet Profil → « Capture d'écran Strava / Garmin » | saisie date / km / D+, points **en attente** de validation |
| Temps de passage estimés, route comme trail (Mathieu) | onglet Course → vue « Passages » | tous les 1 km (≤ 15 km) ou 5 km, allure ajustée à la pente |
| Séances en côte | détail d'une côte → « Séance de côtes » | répétitions, durée, D+, points prévus |

### Barème actuel

- 1 point par km ; 1 point par 10 m de D+ (10 m de D+ valent 1 km : le trail n'est pas pénalisé) ;
- chaque montée complète d'une côte de l'appli : 1 point par 5 m de D+ de la côte, comptée
  **automatiquement** depuis le GPX (passage au pied puis au sommet, distance cohérente) ;
- distance comptée jusqu'à 250 km par semaine.

### Pourquoi le GPX plutôt que la photo

Une capture d'écran se retouche en 30 secondes, ou se récupère chez un ami. Dès qu'il y a des
cadeaux, certains tricheront. Le GPX (exportable depuis Garmin Connect et Strava) porte la date et
l'heure de chaque point, la trace et les altitudes : l'appli vérifie la date (après la création du
compte), les doublons, la vitesse (pas de vélo) et compte les côtes. La photo reste possible, mais
ses points attendent une validation humaine.

## Reste à faire

### 1. Comptes en ligne et classement (nécessite un serveur)

Classement entre tous les coureurs, modération des captures, lots de fin d'année. Proposition :
**Supabase** (base Postgres, comptes, stockage des captures, hébergement en Europe, gratuit au
démarrage). À prévoir :
- recalcul des points côté serveur à partir du GPX (le téléphone ne doit pas être cru sur parole) ;
- détection des GPX identiques entre comptes, et des vitesses ou fréquences cardiaques irréalistes ;
- RGPD : les traces GPS révèlent le domicile → zone de confidentialité autour du départ, suppression
  du compte et des données, mentions d'information.

### 2. Cadeaux de fin d'année : cadre légal

Un classement avec des lots est un jeu-concours : il faut un **règlement** (dates, critères,
lots, modalités de désignation des gagnants), accessible gratuitement, et une participation qui
ne dépend d'aucun achat. À faire relire par un juriste avant le lancement. Des partenaires
(marques, magasins, organisateurs de courses) peuvent fournir les lots.

### 3. Calendrier des courses (Mathieu)

« Organiser son planning de l'année, connaître les courses selon la distance, les dates de course
et d'inscription, le prix du dossard, le logement. »
- Pas de scraping des sites de calendriers. Pistes : données ouvertes (à rechercher sur
  data.gouv.fr), partenariats avec les organisateurs, formulaire où un organisateur inscrit sa
  course, contributions des utilisateurs modérées.
- Une fois les courses en base : filtre distance / D+ / date / région, rappel d'ouverture des
  inscriptions, profil de la course analysé comme un GPX, plan nutrition et temps de passage.
- Logement : lien vers des recherches (sans affiliation au départ).

### 4. Meilleurs spots de côtes et de trail en Bretagne (Mathieu)

Direct avec le précalcul : étendre la base à la Bretagne, puis classer les secteurs par nombre de
côtes, dénivelé cumulé et part de sentiers (« spots »). Écran « Spots » avec carte.

### 5. Crampes et fatigue sur longue distance (Théo)

Déjà en partie : sodium par heure et ajustement à la chaleur dans le plan nutrition. À ajouter :
rappels de prise pendant la course (toutes les 20–30 min), conseils d'entraînement en côte et en
descente (renforcement excentrique), avec la mention que ce ne sont pas des conseils médicaux.

### 6. Varier les séances spécifiques marathon (Théo)

Générateur de séances à partir de l'objectif (allure marathon, seuil, VMA estimés depuis un
temps de référence) : fractionnés longs, tempo, sorties longues avec blocs à allure, et séances
en côte sur les côtes proches. Les séances réalisées rapportent des points.

## Ordre proposé

1. Serveur et comptes (débloque le classement et les cadeaux) ;
2. Bretagne entière dans la base + écran Spots ;
3. Générateur de séances (marathon et côtes) ;
4. Calendrier des courses, selon les partenariats possibles.
