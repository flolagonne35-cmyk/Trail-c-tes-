# Refonte de l'appli : cinq rubriques bien distinctes

Réponse au message de Florian du 05/11/2026 (« trop fouillis, des choses se ressemblent sur
chaque page »). Pour chaque point : ce que je propose, pourquoi, ce qui est faisable et ce
qui ne l'est pas, et ce que tu dois faire toi-même.

Règle de conduite pour toute la refonte : **une rubrique = une question du coureur**, sans
doublon d'une rubrique à l'autre. Il faut qu'une personne de 90 ans s'y retrouve : un seul
bouton principal par écran, des mots simples, rien qui se ferme ou se cache sans qu'on l'ait
demandé, et des réglages toujours posés à côté de ce qu'ils changent.

---

## 1. La nouvelle organisation (5 onglets en bas)

| Onglet | La question du coureur | Ce qu'on y trouve | Ce qui en sort |
|---|---|---|---|
| **Aujourd'hui** | « Qu'est-ce que je fais aujourd'hui ? » | séance du jour tirée de mon programme, météo et meilleur créneau, ma semaine (fait / prévu), compte à rebours de ma prochaine course | « Courses près de chez toi », « Je pars courir », le gros bandeau de points |
| **Explorer** | « Où courir ? » | Côtes, Descentes, Boucles ; notes et avis des coureurs sur chaque côte et chaque boucle | — |
| **Programme** | « Comment je m'entraîne ? » | **Mon programme** (questionnaire complet → plan sur mesure), **Sorties** (le parcours de la séance du jour, autour de moi), **Séance** (« 8 × 400 m à 10 % » : où la faire) | l'ancienne « Séance du coach » isolée, sans lien avec un plan |
| **Courses** | « Quelle course, et comment la réussir ? » | **Calendrier** (toutes les courses, par ville et par mois), **Ma course** (plan du jour J : allures, ravitos, nutrition, matériel, trajet, logement) | « Mes courses » et « Courses à venir » séparés (fusionnés : une étoile ★ suffit), l'onglet Nutrition seul |
| **Mon monde** | « Où j'en suis ? » | avatar, points, ligue et classement, défis, boutique d'équipement, badges, records | — |

Le menu ☰ ne garde que ce qui n'est pas une rubrique : réglages, données et confidentialité,
aide. Il ne répète plus les onglets.

**Pourquoi la Nutrition n'est plus un onglet** : les chiffres de glucides, d'eau et de sel n'ont
de sens que pour **une sortie longue** ou **une course**. Ils vont donc là où on en a besoin :
dans « Ma course » (plan du jour J) et dans les sorties longues du programme (voir § 6).

---

## 2. Accueil → « Aujourd'hui »

> « Dans une page d'accueil, est-ce que les infos qu'on a rentrées sont en général celles-ci ? »

Non, pas toutes. Les applis de course de référence ouvrent sur **une seule chose** :
- Nike Run Club, Runna, Campus Coach : **la séance du jour** et un gros bouton ;
- Garmin Connect : « Ma journée » (forme, sommeil, séance prévue) ;
- Strava : le fil des amis (réseau social, ce n'est pas notre cas).

Aujourd'hui, notre accueil empile un bandeau de points, la séance du jour, les courses proches
et « Je pars courir » : quatre sujets différents, dont deux sont déjà ailleurs.

**Proposition**, de haut en bas :
1. **Séance du jour** en grand : « 10 km avec 200 m D+, en endurance », avec un seul bouton
   « Voir les parcours » (qui ouvre Programme → Sorties déjà réglé) ;
2. **Météo** du jour à ma position et le **meilleur créneau** (« 18 h : 14 °C, sans pluie ») ;
3. **Ma semaine** : barre « 23 km faits sur 40 prévus », D+ ;
4. **Ma prochaine course** : « Trail de Brocéliande dans 47 jours ».

Les points restent visibles en petit à côté de l'avatar (en haut à droite) : un appui ouvre
Mon monde.

---

## 3. Explorer (ex-Côtes) — fait le 05/11

Corrections faites tout de suite (voir § 11) :
- plus d'air entre les chiffres : fiches plus hautes, données en pastilles (« +34 m »,
  « chemin », « goudronné ») au lieu d'une ligne serrée ;
- « Passage le plus raide » retiré des filtres et du tri : il doublonnait la pente moyenne.
  L'info qui comptait vraiment est gardée autrement : une pastille **« mur à 18 % »** n'apparaît
  que si un passage de 50 m dépasse 15 % et la moyenne d'au moins 5 points (là où on passe
  souvent à la marche) ;
- « Distance du point de départ » devient **« Jusqu'à combien de km de toi ? »**, et chaque
  côte affiche « 2,3 km **de toi** » (ou « de Vannes » si on a choisi une ville) ;
- le tri est **toujours ouvert** et posé **juste au-dessus des résultats** (sous la carte),
  plus de bouton « Changer / Fermer » ;
- après « Voir les côtes », la page repart **du haut** : avant, on atterrissait au niveau du
  bouton, en bas de la liste, sans voir la carte ni le tri (c'est sans doute ce qui donnait
  l'impression que le tri s'était fermé) ;
- carte : légende posée dans la carte, numéros plus gros avec une ombre, voile clair sur le
  Plan IGN pour que les côtes ressortent.

**Carte, pour aller plus loin** : le Plan IGN raster est très chargé (toutes les étiquettes,
couleurs vives). La vraie solution est le **Plan IGN vecteur** (Géoplateforme, Licence Ouverte)
avec un style à nous : routes en gris clair, sentiers en pointillés bruns, relief en ombrage
léger, nos côtes en couleur vive. C'est le rendu des applis haut de gamme (Komoot, Strava). Il
faut passer à MapLibre (module natif sur le téléphone) : 2 à 3 jours, et à valider sur le
workflow car ce conteneur n'accède pas à data.geopf.fr.

**Avis des coureurs** (ton idée) : sous chaque côte et chaque boucle, une note sur 5 et des
mots-clés en un appui (« belle vue », « boueux l'hiver », « bien balisé », « route
dangereuse », « point d'eau »). Le tri « les mieux notées » s'ajoute aux autres. Il faut le
serveur (§ 9) et une modération légère (signalement, retrait d'un avis insultant).

---

## 4. Programme (ex-S'entraîner)

### 4.1 Mon programme : un vrai plan sur mesure

Ce que tu décris, c'est le cœur de l'appli : on se présente, l'appli construit le plan.

**Le questionnaire** (en plusieurs écrans courts, chaque question expliquée, tout facultatif sauf
l'objectif) :
- **Toi** : âge, sexe, poids (pour la nutrition), années de course, blessures récentes ;
- **Ton niveau** : records 5 km, 10 km, semi, marathon, et dernier trail (distance, D+, temps,
  ou cote ITRA si tu la connais), VMA ou FC max si connues ;
- **Ton volume actuel** : km et D+ par semaine sur le dernier mois, plus longue sortie ;
- **Ta vie** : jours possibles (lundi… dimanche), durée maximale par jour, jour de la sortie
  longue, accès à du dénivelé (côtes, montagne à moins d'une heure ?), tapis, piste ;
- **Ton objectif** : course choisie dans le calendrier (date, distance, D+ connus) ou format
  libre, et ambition (finir, un temps, un classement).

**Ce que le plan calcule**, avec ses sources citées dans l'appli :
- allures d'entraînement à partir des records (tables VDOT de Jack Daniels ; temps prédits par
  la formule de Riegel, corrigée du dénivelé pour le trail) ;
- périodisation : foncier → développement → spécifique → affûtage (2 semaines avant un
  marathon, 1 à 3 selon la distance en trail), semaine allégée toutes les 3 ou 4 semaines ;
- progression du volume d'environ 10 % par semaine au plus (prudence classique, contestée
  scientifiquement : on l'adapte au niveau) ;
- répartition **80 % facile / 20 % intense** (Seiler, entraînement polarisé) ;
- spécifique trail : D+ hebdomadaire qui monte vers celui de la course, sorties longues en
  côte et en descente, renforcement excentrique contre les crampes et les quadriceps détruits ;
- **le plan s'adapte** : séance manquée, semaine chargée, fatigue déclarée → le plan se
  recale au lieu de culpabiliser.

L'appli a déjà un générateur (Course → Plan) ; il devient ce programme complet, rangé ici.

### 4.2 Sorties : le parcours de la séance du jour

Exactement ton exemple : mardi, le programme dit « 12 km avec 300 m D+ en endurance ».
L'onglet Sorties propose **3, 5 ou 10 boucles** autour de ta position qui collent
(12 km ± 10 %, D+ ± 15 %), avec pour chacune : carte, profil, part de sentier, routes passantes,
points d'eau, note des autres coureurs, export GPX vers la montre. Le moteur de boucles existe
déjà (toute la France) : il faut le brancher sur la séance du jour et produire plusieurs
variantes au lieu d'une.

### 4.3 Séance

« 8 × 400 m à 10 % » → les meilleurs endroits autour de toi. Reste tel quel, mais rempli
automatiquement quand la séance du jour est une séance de côtes.

---

## 5. Courses

### 5.1 Calendrier de toutes les courses jusqu'à fin 2027

Ce que tu veux : toutes les courses (trail et route), recherche par ville ou par mois, prix du
dossard, places restantes, notoriété, dates d'inscription, mise à jour chaque jour.

**Ce qui est fait et ce qui manque, honnêtement :**

| Donnée | Faisable ? | Comment |
|---|---|---|
| Mise à jour chaque jour | ✅ **fait le 05/11** | le workflow « Calendrier des courses » tourne maintenant chaque jour (DATAtourisme publie un export par jour) |
| Recherche par ville, par mois, trail / route | ✅ en partie | déjà : ville, rayon, période, type, format. À ajouter : vue « par mois » (janvier, février…) en une liste simple |
| Toutes les courses de France | 🟡 ≈ 400 aujourd'hui | aucune base ouverte ne les contient toutes. Le calendrier de la FFA est la référence (plusieurs milliers d'épreuves par an) mais n'a pas d'accès ouvert, et on ne recopie pas le site d'un tiers. **Solution : te rapprocher de la FFA** (service calendrier) **et des plateformes d'inscription** (njuko, Klikego, Protiming, Chronostart, Yaka-inscription) pour un accès à leurs données. C'est une démarche commerciale, **à faire par toi** ; l'argument : on leur apporte des inscrits. |
| Prix du dossard | 🟡 | champ « tarifs » de DATAtourisme avec la **clé API gratuite** (à demander par toi sur datatourisme.fr). Pour l'année précédente, le prix connu reste affiché avec la mention « tarif 2026, à confirmer » |
| Places restantes | ❌ sans partenariat | seule la plateforme d'inscription le sait, en direct. Possible uniquement avec njuko & co |
| Dates d'ouverture des inscriptions | 🟡 | partenariat, ou saisie par les organisateurs et les coureurs. Sans date : « inscriptions l'an dernier : à partir du 15 janvier » (calculé sur l'édition précédente) et un bouton « Me prévenir » |
| Notoriété | ✅ faisable | **Wikidata** (licence CC0, libre) recense les courses connues (UTMB, Templiers, Marathon de Paris…) ; on y ajoute le nombre de partants de l'édition précédente quand il est connu, et le nombre de coureurs de l'appli qui l'ont mise en favori |
| Formulaire organisateur | ✅ avec le serveur | un organisateur déclare sa course (dates, prix, lien d'inscription), vérifiée avant publication |

### 5.2 « Comment y aller » et où dormir

Bonne idée, et faisable avec des sources ouvertes, sans recopier de sites :
- **Voiture** : itinéraire IGN (Géoplateforme, déjà utilisée), coût = carburant au **prix du
  jour** (open data officiel « prix des carburants », mis à jour en continu) × consommation
  choisie, + estimation des péages ;
- **Train** : horaires par l'API SNCF (gratuite avec une clé, **à demander par toi** sur
  api.sncf.com) ; pour le prix, une fourchette indicative et un lien vers SNCF Connect (le prix
  exact dépend du jour de réservation, aucune source ouverte ne le donne) ;
- **Covoiturage** : lien vers BlaBlaCar pré-rempli (ville de départ → ville de la course, date) ;
- **Dormir** : hôtels, campings, gîtes, chambres d'hôtes autour du départ, depuis
  **DATAtourisme** (mêmes données ouvertes que les courses), triés par distance au départ,
  avec un lien vers Booking / Airbnb pré-rempli. Pas d'affiliation au début ; plus tard, les
  liens affiliés peuvent rapporter un peu d'argent (à déclarer dans les mentions légales).

### 5.3 Ma course : le plan du jour J (second onglet)

On importe le GPX de la course et l'appli sort une **feuille de route** :
- le profil découpé en sections (montées, descentes, plats), avec pour chacune l'allure et le
  temps visés, calculés à **ton** allure par pente (déjà appris dans tes GPX) ;
- temps de passage à chaque ravito et **barrières horaires** avec la marge ;
- conseils par section : « marche active dès 12 % », « relance en haut », « descente
  technique : ne pas griller les quadriceps avant le km 40 » ;
- nutrition minute par minute (voir § 6) et ce qu'il faut dans le sac à chaque ravito ;
- matériel obligatoire (check-list), météo prévue au départ et au sommet (dès J-10) ;
- export : **GPX avec les ravitos en points** pour la montre, et une **fiche à imprimer** ou à
  coller sur le bidon.

Beaucoup de calculs existent déjà (profil, passages, nutrition) : le travail est de les réunir
en une seule feuille claire.

---

## 6. Nutrition : la rendre vivante et personnelle

Tu as raison : glucides, eau et sel sont propres à chacun. C'est justement l'idée : l'appli
**apprend tes chiffres** au lieu de donner une moyenne.

1. **Test de sudation guidé** (le plus utile, gratuit) : te peser nu avant et après une sortie
   d'une heure, noter ce que tu as bu → l'appli calcule ta perte en litres par heure (méthode
   de l'ACSM). À refaire au chaud et au frais : l'appli garde les deux et choisit selon la
   météo de la course.
2. **Sel** : questionnaire simple (traces blanches sur la casquette, crampes, goût salé) pour
   classer « peu / moyen / très salé ». La sueur contient de 200 à plus de 2 000 mg de sodium par
   litre selon les personnes, environ 1 000 mg en moyenne (Baker, 2017) : d'où l'intérêt de se situer.
3. **Entraîner son ventre** : on ne passe pas de 40 à 90 g de glucides par heure le jour J.
   Le programme fait monter la dose sortie longue après sortie longue (+10 g/h), et après
   chaque sortie on note le ventre en un geste (😀 😐 🤢). L'appli trouve ta dose qui passe
   (recommandations ISSN et Jeukendrup sur l'« entraînement de l'intestin »).
4. **Mon sac à produits** : tu choisis tes gels, boissons, barres, compotes (base de produits
   avec glucides, sodium, caféine, prix) → le plan te dit « 2 gels + 1 compote + 500 ml de
   boisson par heure » plutôt que des grammes, et le coût de ta course.
5. **Météo du jour J** : chaleur et humidité augmentent l'eau et le sel du plan
   automatiquement.
6. **Caféine** : dose et moment (3 mg/kg environ, à tester à l'entraînement d'abord).
7. **Pendant la course** : rappels sur la montre ou le téléphone toutes les 20 à 30 min (« gel
   n°3 »).

Tout reste sur le téléphone (le poids est une donnée personnelle), avec la mention que ce ne
sont pas des conseils médicaux.

---

## 7. Mon monde (ex-Mes progrès) : ton concept, développé

Ton idée est bonne et c'est ce qui peut faire revenir les coureurs chaque jour. Je propose de
l'appeler **« Les Crêtes »** (nom de travail) : un petit monde de montagne où ton coureur
progresse.

### 7.1 Gagner des points (seulement avec des traces vérifiées)

- **Import automatique des sorties**, sans manipulation :
  - **Garmin Connect** (programme développeur gratuit pour les entreprises, sur demande) ;
  - **Apple Santé** (iPhone) et **Health Connect** (Android) : la plupart des montres (Coros,
    Suunto, Polar, Garmin) y déposent les sorties avec la trace ;
  - import manuel d'un GPX, toujours possible.
  - ⚠ **Strava** : depuis fin 2024, ses conditions interdisent de montrer les données d'un
    coureur aux autres utilisateurs. Donc pas de classement avec des sorties venues de Strava.
- **Barème** (existe déjà, à enrichir) : distance, D+ (10 m = 1 km), côtes de l'appli montées
  en entier, séances du programme réussies, régularité (série de semaines), allure (bonus
  quand tu bats ton record sur une côte : on se compare à soi-même, pas aux autres, sinon les
  plus rapides gagnent toujours).
- **Triche** : vitesse, cadence, FC, doublons de traces entre comptes, vérifiés sur le serveur.

### 7.2 Classements qui donnent envie à tout le monde

Un seul classement national décourage 99 % des gens. Mieux :
- **Ligues de la semaine** par groupes de 30 coureurs de niveau proche (Bronze → Argent → Or →
  Diamant → Sommet), les premiers montent, les derniers descendent (le système de Duolingo) ;
- **Roi / Reine de la côte** : le meilleur temps sur chaque côte de l'appli, et « le plus de
  montées » pour les plus réguliers ;
- classements entre amis et par club ;
- **saisons** de 3 mois avec un thème (« Saison des Alpes », « Saison de l'hiver ») qui
  remettent les compteurs de ligue à zéro.

### 7.3 Boutique et équipement de l'avatar

- Les points s'échangent contre de l'équipement pour l'avatar : bâtons, chaussures, gilet,
  frontale, casquette, montre, médailles, fonds de décor (crêtes, glaciers, forêt bretonne).
- **Rareté** visible : Commun (gris), Rare (bleu), Épique (violet), **Légendaire (or, animé)**.
  Les objets légendaires ne s'achètent pas : ils se **méritent** (« Bâtons de l'Ultra » : finir
  une course de plus de 80 km avec la trace) → c'est ce qui fait qu'on sait que quelqu'un est
  fort en voyant son avatar, comme tu le dis.
- **Marques (Salomon…)** : on ne peut pas utiliser leurs noms ni leurs logos sans leur accord
  (droit des marques). Au début, objets génériques (« bâtons carbone ultralégers ») ; ensuite,
  **objets de marque en partenariat** : c'est un vrai modèle économique (la marque paie pour
  être dans le jeu, et peut offrir le vrai produit au gagnant d'une saison). **Démarche à
  faire par toi.**
- **Pas de coffres au hasard payants** : c'est très encadré (Belgique, Pays-Bas ; débat en
  France). Ici les points se gagnent en courant, jamais en payant : on reste tranquilles.

### 7.4 Défis et badges

Défis de la semaine (« 3 côtes à plus de 8 % »), défis du mois (« 1 000 m D+ »), défis rares
(« Everesting » : 8 848 m D+ cumulés sur la même côte), badges de collection (« toutes les
côtes de Rennes »). Chaque déblocage a son animation.

### 7.5 L'écran doit en mettre plein les yeux

- carte du monde animée : ton avatar avance sur un sentier de montagne au fil des points, les
  paliers sont des refuges, des cols et des sommets ;
- animations (Lottie / Reanimated) : coffre qui s'ouvre quand on débloque un objet, confettis
  à la montée de ligue, aura dorée des objets légendaires ;
- l'avatar change de pose avec la forme de la semaine.

Ça demande un vrai travail de graphisme : je peux faire une première version animée en SVG,
mais pour une qualité « jeu vidéo », il faudra **un graphiste / illustrateur** (à trouver par
toi, quelques milliers d'euros pour un pack d'objets et de décors).

### 7.6 Cadeaux

Un classement avec des lots est un **jeu-concours** : règlement, participation gratuite, sans
obligation d'achat (déjà noté dans la feuille de route, § 2.4). Les lots peuvent venir des
marques partenaires.

---

## 8. L'avatar

### 8.1 Que mettre quand on touche l'avatar ?

Une **fiche de coureur**, comme une carte de joueur :
- avatar en grand avec son équipement, ligue, niveau ;
- chiffres de l'année : km, D+, sorties, côtes montées, courses finies ;
- **records** (5 km, 10 km, semi, marathon, meilleur temps sur mes côtes favorites) ;
- vitrine de badges et d'objets rares ;
- mes courses passées et à venir ;
- un bouton « Partager ma carte » (image pour Instagram / WhatsApp : c'est aussi ce qui fait
  connaître l'appli).

### 8.2 Avatar 3D très réaliste, avec ma tête ?

- **Avatar 3D stylisé** (style Fortnite / Bitmoji 3D) : **oui**, c'est faisable (modèle 3D avec
  équipement interchangeable, affiché en temps réel). C'est aussi ce qui se marie le mieux avec
  la boutique d'objets. Il faut des modèles 3D faits par un **artiste 3D**.
- **Avatar créé à partir d'une photo** : techniquement possible (des services spécialisés le
  font), mais je **déconseille** pour le lancement :
  1. une photo de visage transformée en modèle est une **donnée biométrique** au sens du RGPD :
     régime strict, consentement explicite, analyse d'impact, et les stores regardent ça de près ;
  2. ces services sont payants, souvent hors d'Europe, et l'un des plus connus a fermé du jour
     au lendemain début 2026 : risque de tout perdre ;
  3. un avatar « presque réel » tombe vite dans l'étrange (« uncanny valley ») ; un style
     assumé vieillit mieux.
  **Alternative** : l'appli propose des réglages proches de toi (couleur de peau, cheveux,
  barbe, lunettes) en quelques questions. Elle peut aussi, plus tard, les proposer à partir d'une
  photo **analysée sur le téléphone seulement** (rien n'est envoyé, la photo est effacée), ce qui
  évite la plupart des problèmes.

---

## 9. Le serveur : la condition pour la moitié des idées

Classements, avis, boutique, import Garmin, formulaire organisateur : tout ça a besoin de
comptes et d'un serveur. Proposition déjà notée : **Supabase** (base de données, comptes,
hébergement en Europe, gratuit au départ, ≈ 25 $/mois ensuite). **À faire par toi** : créer le
compte Supabase (région Europe) et me donner accès par les secrets GitHub.

---

## 10. Météo, boussole, gadgets

### Météo : oui
- **Source** : Météo-France (API publiques, gratuites avec une clé, Licence Ouverte). La clé est
  **à demander par toi** sur portail-api.meteofrance.fr.
- **Où** : sur Aujourd'hui (temps du jour et meilleur créneau), dans Ma course (prévision du
  jour J dès J-10, au départ et au sommet), et dans la nutrition (chaleur → plus d'eau et de sel).
- **Lever et coucher du soleil** : calculés sur le téléphone, sans réseau. « Coucher à 17 h 32 :
  prends ta frontale » si la sortie finit après.

### Boussole : oui, mais utile
Une boussole seule ne sert à rien (le téléphone en a déjà une). Ce qui sert vraiment :
**« Retour au départ »** : une flèche qui pointe vers ta voiture ou ton point de départ, avec la
distance, **sans réseau**. Sécurité réelle en trail quand on se perd. (Sur la version web
d'iPhone, Safari demande une autorisation spéciale pour la boussole : à tester.)

### Petits gadgets à ajouter
1. **Minuteur de répétitions en côte** : bip et vibration au départ et à la récup de chaque
   répétition, compte des montées ;
2. **Convertisseur** allure ↔ vitesse ↔ temps, et prédiction de temps (Riegel) ;
3. **Check-list du sac** (matériel obligatoire des grands trails) ;
4. **Mode jour de course** : écran géant, prochain ravito, prochain gel, barrière horaire ;
5. **Carte de partage** de sortie ou de côte, joliment dessinée, pour les stories ;
6. **Widget** sur l'écran d'accueil du téléphone : séance du jour et compte à rebours.

### Ce que j'enlèverais
1. l'onglet **Nutrition** seul (rangé dans Ma course et les sorties longues) ;
2. **« Courses près de chez toi »** et **« Je pars courir »** sur l'accueil : le premier est dans
   Courses ; le second va au moment où on lance une sortie (bouton « Prévenir un proche » sur
   l'écran de la boucle) ;
3. **« Mes courses »** comme écran séparé : une étoile ★ dans le calendrier suffit, et le budget
   de l'année va dans Mon monde ;
4. la **preuve par capture d'écran Strava** : trop facile à truquer, inutile une fois l'import
   automatique en place ;
5. le **filtre « passage le plus raide »** (fait) ;
6. les doublons du **menu ☰** avec les onglets.

---

## 11. Ordre de construction proposé

| Étape | Contenu | Durée indicative | Prérequis de ton côté |
|---|---|---|---|
| ✅ 0 | Corrections Côtes (air, tri, distance « de toi », mur, carte), calendrier quotidien | fait le 05/11 | — |
| 1 | Nouvelle navigation à 5 onglets, Aujourd'hui, fusion Mes courses / Calendrier, vue par mois | 1 semaine | valider ce document |
| 2 | Mon programme (questionnaire complet, plan adaptatif) + Sorties (3/5/10 boucles du jour) | 2 semaines | — |
| 3 | Ma course : feuille du jour J, nutrition personnelle (test de sudation, sac à produits) | 1 à 2 semaines | — |
| 4 | Météo, lever/coucher du soleil, retour au départ, minuteur de côtes | 1 semaine | clé Météo-France |
| 5 | Serveur et comptes, import Garmin / Santé, avis | 2 à 3 semaines | compte Supabase, demande Garmin |
| 6 | Mon monde : ligues, boutique, défis, animations | 3 à 4 semaines | graphiste pour les objets |
| 7 | Trajets et logements, courses en partenariat (prix, places, inscriptions) | 2 semaines | clé SNCF, clé DATAtourisme, démarches FFA / njuko |
| 8 | Avatar 3D stylisé | 3 semaines et plus | artiste 3D |
