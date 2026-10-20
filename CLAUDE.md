# Consignes pour Claude — Trail-côtes

## Règle : face à une limite, chercher une solution

Quand tu butes sur quelque chose (donnée manquante, service bloqué, limite d'une source, cas
non géré), ne te contente pas de le signaler comme « limite connue » :

1. Cherche d'abord si la donnée existe déjà dans ce qu'on a (champs BD TOPO, rapport du dernier
   run, autre ressource IGN). Lis le `rapport.json` : il garde un exemple de réponse brute.
2. Sinon, cherche une autre source ouverte et légale (IGN, data.gouv.fr, OpenStreetMap…).
   Jamais de scraping de sites tiers.
3. Implémente la solution, avec un repli propre si la source ne répond pas, et un test hors réseau.
4. Si aucune solution ne tient (coût, licence, précision), explique pourquoi et propose la
   meilleure alternative. Ne demande à l'utilisateur que si le choix change vraiment le résultat
   (par exemple une licence qui impose des obligations).

## Règle : penser comme le meilleur développeur d'appli, traileur de haut niveau

Chaque fonction est pensée et livrée comme dans une appli de sport professionnelle, utilisée par
des coureurs exigeants partout en France :

1. **Se renseigner avant de coder** : comment la chose fonctionne vraiment (science du sport,
   format de fichier, service, règle des stores). Citer la source dans le code ou la doc
   (ex. recommandations nutrition ACSM / ISSN).
2. **Chaque réglage s'explique** dans l'appli : à quoi il sert, sur quoi il agit, valeurs
   conseillées. Jamais un chiffre sans contexte.
3. **Vérifier de bout en bout avant de livrer** : tests hors réseau, puis la version web au
   format téléphone (Playwright) en cliquant **chaque bouton** de chaque écran
   (`scripts/audit_boutons.js` ou équivalent), sans erreur de page. Captures relues.
4. **Penser au coureur sur le terrain** : sans réseau, montre GPS (export GPX), sécurité (routes
   fréquentées, ponts et tunnels qui faussent les pentes), données personnelles qui restent sur
   le téléphone sauf accord explicite.
5. **Penser à l'échelle nationale** : précalcul par département, base géographique, l'appli ne
   charge que le rayon utile.
6. **Dire à l'utilisateur ce qu'il doit faire lui-même** (comptes développeur, stores, juridique)
   et tenir à jour `docs/feuille-de-route.md`.

## Projet

- Scripts dans `scripts/`, tests hors réseau dans `tests/` (`pytest -q`), résultats écrits par
  GitHub Actions dans `resultats/`.
- Ce conteneur n'accède pas à `data.geopf.fr` : on valide sur les services réels via le workflow
  « Côtes Rennes (API IGN) », puis on lit `resultats/*/rapport.json`.
- Code et commentaires en français, comme l'existant.
- Services vérifiés en réel : altimétrie `ign_rge_alti_wld` (lots de 150 points, ~0,8 s par
  requête, champ `acc` sans intérêt) ; WFS `BDTOPO_V3:troncon_de_route` (BBOX en lat,lon
  EPSG:4326, coordonnées renvoyées en lon,lat).
