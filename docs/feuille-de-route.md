# Feuille de route — de la maquette à une vraie application

Mise à jour : 20/10/2026. Trois parties : **ce que l'appli fait déjà**, **ce que tu dois faire
toi-même** (personne ne peut le faire à ta place : comptes, argent, juridique), et **ce qu'il
reste à construire**, par étapes.

---

## 1. Où on en est

### Tes demandes (message du 20/10)

| Demande | État | Où |
|---|---|---|
| Nutrition compréhensible | ✅ | Course → Nutrition : « Comment c'est calculé », routine horaire, conseil sur chaque réglage, sources |
| Tous les boutons qui marchent | ✅ vérifié | `scripts/audit_boutons.js` : 20 écrans, ≈ 420 boutons cliqués un par un, 0 sans effet, 0 erreur de page (20/10) |
| Filtrer par longueur et par D+ | ✅ | Côtes → Filtres : courtes < 300 m, moyennes 300-800 m, longues ≥ 800 m ; D+ minimum |
| Enchaîner des côtes dans une boucle | ✅ zone de Rennes | Côtes → Boucle : distance, nombre de côtes, D+ visé, sans route, sans route passante |
| Export GPX vers la montre | ✅ | côte, séance et boucle ; s'importe dans Garmin Connect, Coros, Suunto, Strava |
| Sans réseau | 🟡 | côtes, boucles, recherche de ville, nutrition : oui ; carte : « Carte hors ligne » (5 km autour du départ, ≈ 45 Mo) **écrite mais pas encore essayée sur un téléphone** |
| Mes temps sur une même côte | ✅ | détail d'une côte → Mes passages (chrono pied → sommet, FC, record, m/h) |
| Sécurité (route fréquentée) | ✅ | trafic BD TOPO (importance, vitesse, voies) : badge ⚠, filtre, explication |
| Chercher un lieu, préparer à l'avance | ✅ | 35 000 communes sans réseau, adresses IGN, lieux récents |
| La séance, pas la côte (« 8 × 400 m à 10 % ») | ✅ | Côtes → Séance : 3 endroits, départ / arrivée de la portion, durée, GPX |
| Préparer ma course près de chez moi | ✅ | Course → Prépa : passages-clés du GPX et côte équivalente + répétitions |
| Les descentes | ✅ | Côtes → Descentes (et séances en descente) |
| Prévisions à mon allure | ✅ | allure apprise par tranche de pente dans mes GPX (S'entraîner → Mes progrès) ; Course → « À ton allure » |
| Plus d'onglets, bien rangés | ✅ | 5 onglets en bas + menu ☰ par catégorie (Explorer, S'entraîner, Courses, Moi, Infos) |
| Nutrition visible | ✅ | onglet à part entière, aussi sans GPX (pour une durée) |
| Courses dans le coin | 🟡 | « Mes courses » : calendrier perso, budget, compte à rebours. Calendrier national / mondial : voir § 2.6 (partenariats) |
| Trouver sa course, plan personnalisé | ✅ | Course : par nom (catalogue de référence), par format (« trail 30 km 1500 m ») ou GPX ; questionnaire (niveau, séances, volume, objectif, date) ; plan semaine par semaine dont chaque séance ouvre l'endroit où la faire |
| Sortie sur mesure (« 2 h sur du plat ») | ✅ | S'entraîner → Sortie : durée ou distance, plat / vallonné / avec côtes, chemins, GPX |
| Côtes seulement après la recherche | ✅ | Côtes : « Que cherches-tu ? » puis les résultats |
| Points d'eau, position partagée, état des sentiers | 🔜 | voir 3.2 |
| Ponts, tunnels, autoroutes | ✅ | exclus du calcul des pentes depuis le début (BD TOPO `position_par_rapport_au_sol`, natures) |
| Données qui partent sans le savoir | ✅ aujourd'hui | tout reste sur le téléphone ; à garder avec les comptes (voir 2.4) |

### Ce qui limite encore

- **Une seule zone calculée** (Rennes, ≈ 9 × 8 km : 168 côtes, 15 600 carrefours pour les boucles).
  Le calcul tourne sur GitHub, une zone à la fois (≈ 4 min par carré de 4 km).
- **Pas de serveur** : pas de compte, pas de classement entre coureurs, pas de sauvegarde si on
  change de téléphone.
- **Pas encore sur un vrai téléphone** : on teste la version web. Il faut une version installable.
- La difficulté technique d'un sentier (racines, cailloux) n'existe dans aucune donnée publique :
  elle viendra des retours des coureurs.

---

## 2. Ce que TU dois faire

Dans l'ordre. Je te prépare tout le reste (configuration, textes, captures).

### 2.1 Tout de suite (gratuit)

1. **Essayer l'appli sur ton téléphone Android** : sur le téléphone, connecté à GitHub, ouvrir le
   dépôt → choisir la branche **`apk`** → `trail-cotes.apk` → « Download » (ou « View raw ») →
   ouvrir le fichier et autoriser l'installation depuis le navigateur. Une nouvelle version se fabrique avec *Actions* → « Appli Android à installer »
   → *Run workflow*. (Sur iPhone, il faut le compte Apple : voir 2.2.)
2. **Créer un compte Expo** sur expo.dev, puis un *access token* (Settings → Access tokens) et
   l'ajouter dans GitHub : dépôt → Settings → Secrets and variables → Actions → *New repository
   secret* → nom `EXPO_TOKEN`. Il sert aux versions iPhone et aux stores (workflow « Appli iPhone
   et stores (EAS) »).
3. **Trouver 12 testeurs traileurs** (Mathieu, Théo, ton club). Google l'exige : un compte
   développeur personnel doit faire tester l'appli à **au moins 12 personnes pendant 14 jours**
   avant de pouvoir la publier.
4. **Choisir les zones suivantes** : il suffit d'ajouter une ligne dans `scripts/zones.json`
   (nom et rectangle lat/lon) ; le calcul part tout seul sur GitHub.

### 2.2 Avant la publication (≈ 120 € la première année)

| Quoi | Coût | Pourquoi |
|---|---|---|
| Apple Developer Program (developer.apple.com) | 99 $ / an | obligatoire pour l'iPhone (TestFlight puis App Store). Ensuite : App Store Connect → Utilisateurs et accès → Intégrations → créer une clé API, et l'ajouter en secrets GitHub (`EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_ASC_API_KEY` = contenu du .p8, `EXPO_APPLE_TEAM_ID`) |
| Google Play Console (play.google.com/console) | 25 $ une fois | obligatoire pour Android ; pièce d'identité demandée |
| Nom de domaine (ex. trailcotes.fr) | ≈ 10 € / an | site, adresse mail de contact, page de confidentialité |

Les deux stores demandent ton identité (ou celle d'une société), une adresse et un téléphone.

### 2.3 Nom et identité

- Vérifier que le nom est libre : base des marques sur **data.inpi.fr** (et les stores). Déposer
  la marque coûte ≈ 190 € (1 classe) : utile si l'appli marche, pas urgent.
- Icône (1024 × 1024), écran de démarrage, captures pour les stores : je les prépare.

### 2.4 Juridique (avant d'ouvrir les comptes et les cadeaux)

- **Politique de confidentialité** (obligatoire sur les deux stores) et **mentions légales** :
  je rédige un premier jet ; une relecture par un juriste est conseillée.
- **RGPD** : la position est une donnée personnelle, la **fréquence cardiaque peut être une
  donnée de santé** (régime renforcé). Règle simple, qui répond à « des données qui partent
  sans le savoir » : tout reste sur le téléphone par défaut ; rien n'est envoyé sans un choix
  explicite (classement, partage de position), hébergement en Europe.
- **Cadeaux de fin d'année** : c'est un jeu-concours. Il faut un règlement (gratuit, sans
  obligation d'achat, dotations, modalités) ; le dépôt chez un commissaire de justice n'est plus
  obligatoire mais protège en cas de litige.
- **Encaisser de l'argent** (abonnement) : il faut un statut, la micro-entreprise suffit au
  début. Apple et Google prennent 15 % (programmes « petites entreprises »).

### 2.6 Calendrier de toutes les courses (avec dates d'inscription)

Aucune base ouverte et réutilisable ne recense les courses du monde avec leurs inscriptions :
ITRA et UTMB publient leurs calendriers sans licence de réutilisation, et recopier leurs sites
(ou un jeu de données qui l'a fait) n'est pas permis. L'appli contient un **catalogue de
référence** (formats indicatifs, lien vers le site officiel) et « Mes courses ». Pour aller plus loin,
c'est une démarche commerciale, à faire par toi :
1. **Contacter l'ITRA** (itra.run) et **UTMB World** pour un accès partenaire à leur calendrier ;
2. **Contacter les plateformes d'inscription** utilisées par les organisateurs français (njuko, et
   les autres que tu croises sur les pages d'inscription) : elles ont les dates d'ouverture des
   inscriptions et peuvent proposer une API partenaire ;
3. **Ouvrir l'appli aux organisateurs** : un formulaire où ils déclarent leur course (je le construis
   avec les comptes en ligne, étape 3.1).

### 2.5 Décider

- **Modèle** : gratuit (côtes, recherche, nutrition) + abonnement (séances, boucles, prépa de
  course, hors ligne complet, comparaison de passages) ? Ce que tes testeurs diraient payer est la
  meilleure réponse.

---

## 3. Ce qu'il reste à construire

### 3.1 Étape 1 — une vraie appli de test (2 à 4 semaines)

- ✅ **Version installable Android** : APK fabriqué sur GitHub (workflow « Appli Android à
  installer », ≈ 15 min), publié sur la branche `apk` ; icône et écran de démarrage, permissions
  minimales expliquées en français.
- **iPhone et stores** : workflow EAS prêt, attend les comptes (2.1 et 2.2). Identifiant choisi :
  `fr.trailcotes.app` (à changer avant la première publication si le nom change).
- 🟡 **Couverture** : Rennes Métropole et Nantes Métropole (dont Couëron) en cours de calcul
  (`scripts/zones.json`) ; boucles sur Rennes centre et Nantes–Couëron. Ensuite Ille-et-Vilaine
  puis Loire-Atlantique entières. Mesuré : ≈ 4 min par carré de
  4 × 4 km, soit ≈ 1 h 30 par 400 km² ; l'Ille-et-Vilaine (6 800 km²) demande ≈ 27 h, en
  passages de 5 h sur GitHub. Pour la France entière, il faudra un petit serveur.
- **Base géographique** : les côtes et le réseau dans une base (PostgreSQL + PostGIS, ou
  Supabase hébergé en Europe) ; l'appli ne télécharge que la zone utile et la garde pour le hors
  ligne.
- **Carte hors ligne** : « Télécharger cette zone » (tuiles Plan IGN de la zone, quelques dizaines
  de Mo) ; à terme carte vectorielle (MapLibre + Plan IGN vectoriel) : plus nette, plus légère,
  rotation, relief.
- **Comptes** (Supabase Auth : e-mail, Apple, Google) pour la sauvegarde et le classement.
- **Suivi des plantages** (Sentry) et mesures d'usage anonymes, hébergées en Europe.

### 3.2 Étape 2 — ce qui fait revenir chaque semaine

- **Prévisions à mon allure** : à partir de mes GPX, mon allure réelle par tranche de pente
  (−20 % … +25 %), puis temps de passage et durées de séance calculés avec elle. Indiquer
  l'écart quand une course est importée après coup.
- **Points d'eau** : fontaines et points d'eau OpenStreetMap (`amenity=drinking_water`) sur les
  boucles et la carte, avec la date de dernière vérification.
- **Sécurité** : partage de position en direct avec un proche, alerte si arrêt prolongé (demande
  la localisation en arrière-plan : à justifier auprès d'Apple et Google).
- **Signalements** des coureurs : boue, arbre tombé, chemin fermé, technicité réelle ; validés
  par les signalements suivants.
- **Calendrier des courses** : sans recopier d'autres sites (interdit) ; inscription des
  organisateurs eux-mêmes, ou partenariat / données ouvertes.
- **Séances marathon et trail** variées (idée de Théo), crampes et alimentation en ultra.

### 3.3 Étape 3 — la France entière

- Précalcul des 96 départements sur un serveur (quelques semaines de calcul, puis mises à jour
  trimestrielles de la BD TOPO).
- Classement par région, défis du mois, lots de fin d'année.
- Abonnement.

### 3.4 Design : ce qui changera le plus la perception

- **Une vraie identité** : logo, icône, couleurs et typographie dédiées (une police sport
  lisible), illustrations des états vides.
- **Carte plein écran** comme écran principal des côtes, avec une feuille qu'on tire vers le haut
  pour la liste (le geste des applis de cartes).
- **Animations et retours tactiles** (vibrations légères), squelettes de chargement.
- **Mode sombre** (courir tôt ou tard).
- Tests avec 5 vrais coureurs, en les regardant utiliser l'appli sans rien expliquer.

---

## Vérifications automatiques

- `pytest -q` (scripts), `cd app && npm test` (calculs de l'appli), `npm run typecheck`.
- `scripts/audit_boutons.js` : clique chaque bouton de chaque écran sur la version web au format
  téléphone et signale toute erreur ou tout bouton sans effet.
