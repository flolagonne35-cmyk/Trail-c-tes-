"""Adresse du pied de chaque côte, par le géocodage inverse de la Géoplateforme (Base Adresse Nationale).

Calculée une fois au précalcul et stockée dans la base : l'application l'affiche sans requête,
même hors connexion. Service limité à 50 requêtes par seconde : on reste très en dessous.
"""

from __future__ import annotations

import sys
import time

REVERSE = "https://data.geopf.fr/geocodage/reverse"


def adresse_ign(lat: float, lon: float, session=None) -> str | None:
    import requests

    s = session or requests.Session()
    r = s.get(REVERSE, params={"lat": f"{lat:.6f}", "lon": f"{lon:.6f}", "index": "address", "limit": 1}, timeout=20,
              headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
    r.raise_for_status()
    feats = r.json().get("features") or []
    return feats[0].get("properties", {}).get("label") if feats else None


def completer_adresses(con, trouver=adresse_ign, pause: float = 0.1) -> tuple[int, int]:
    """Remplit la colonne `adresse` des côtes qui n'en ont pas. Renvoie (trouvées, échecs)."""
    lignes = con.execute("SELECT id, lat_depart, lon_depart FROM cotes WHERE adresse IS NULL").fetchall()
    trouvees = echecs = 0
    for ligne in lignes:
        try:
            a = trouver(ligne["lat_depart"], ligne["lon_depart"])
        except Exception as exc:  # une adresse manquante n'empêche rien : l'appli la demandera elle-même
            print(f"  ! adresse côte {ligne['id']} : {type(exc).__name__}: {exc}", file=sys.stderr)
            echecs += 1
            continue
        con.execute("UPDATE cotes SET adresse = ? WHERE id = ?", (a or "", ligne["id"]))
        trouvees += 1
        time.sleep(pause)
    con.commit()
    return trouvees, echecs
