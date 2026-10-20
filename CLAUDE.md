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

## Projet

- Scripts dans `scripts/`, tests hors réseau dans `tests/` (`pytest -q`), résultats écrits par
  GitHub Actions dans `resultats/`.
- Ce conteneur n'accède pas à `data.geopf.fr` : on valide sur les services réels via le workflow
  « Côtes Rennes (API IGN) », puis on lit `resultats/*/rapport.json`.
- Code et commentaires en français, comme l'existant.
- Services vérifiés en réel : altimétrie `ign_rge_alti_wld` (lots de 150 points, ~0,8 s par
  requête, champ `acc` sans intérêt) ; WFS `BDTOPO_V3:troncon_de_route` (BBOX en lat,lon
  EPSG:4326, coordonnées renvoyées en lon,lat).
