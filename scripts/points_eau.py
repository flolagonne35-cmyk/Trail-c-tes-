#!/usr/bin/env python3
"""Points d'eau potable de toute la France (OpenStreetMap), pour les boucles de l'appli.

Source : OpenStreetMap via l'API Overpass, licence ODbL (« © les contributeurs d'OpenStreetMap »,
mention affichée dans l'appli). On garde ce qui sert à remplir une gourde :
  - amenity=drinking_water (fontaine, robinet public d'eau potable) ;
  - amenity=water_point ou man_made=water_tap marqués drinking_water=yes ;
et on écarte drinking_water=no et les accès privés (access=private/no).
Pour chaque point : type, nom, saisonnier (seasonal=*, souvent coupé l'hiver) et date de dernière
vérification (check_date) quand les contributeurs l'ont renseignée.

France découpée en cases de 1° (métropole, Corse, outre-mer) : une requête par case, un fichier
par case (eau_<lat>_<lon>.json, coin sud-ouest). L'appli ne charge que les cases autour du départ.

Exemples :
  python scripts/points_eau.py --sortie resultats/eau
  python scripts/points_eau.py --case 48,-2 --sortie /tmp/eau        # une seule case
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

OVERPASS_URLS = ("https://overpass-api.de/api/interpreter",
                 "https://overpass.kumi.systems/api/interpreter",
                 "https://maps.mail.ru/osm/tools/overpass/api/interpreter")
SOURCE = "© les contributeurs d'OpenStreetMap (ODbL)"
TYPES = ("fontaine", "point d'eau", "robinet")

# emprises [lat_min, lon_min, lat_max, lon_max] : métropole et Corse, puis outre-mer
EMPRISES = [
    (41.3, -5.2, 51.1, 9.6),      # métropole et Corse
    (15.8, -61.9, 16.6, -61.0),   # Guadeloupe
    (14.3, -61.3, 14.9, -60.8),   # Martinique
    (2.1, -54.7, 5.8, -51.6),     # Guyane
    (-21.4, 55.2, -20.8, 55.9),   # La Réunion
    (-13.1, 44.9, -12.6, 45.4),   # Mayotte
]


def cases() -> list[tuple[int, int]]:
    vues = []
    for a, b, c, d in EMPRISES:
        for la in range(math.floor(a), math.floor(c) + 1):
            for lo in range(math.floor(b), math.floor(d) + 1):
                if (la, lo) not in vues:
                    vues.append((la, lo))
    return vues


def requete(la: int, lo: int) -> str:
    bbox = f"{la},{lo},{la + 1},{lo + 1}"
    return (f"[out:json][timeout:180];("
            f"nwr[\"amenity\"=\"drinking_water\"]({bbox});"
            f"nwr[\"amenity\"=\"water_point\"][\"drinking_water\"=\"yes\"]({bbox});"
            f"nwr[\"man_made\"=\"water_tap\"][\"drinking_water\"=\"yes\"]({bbox});"
            f");out center tags;")


def interroger(texte: str, essais: int = 3, pause: float = 10) -> list[dict] | None:
    """Éléments Overpass, ou None si aucun serveur n'a répondu (la case est alors gardée telle quelle)."""
    import requests

    for essai in range(essais):
        for url in OVERPASS_URLS:
            try:
                r = requests.post(url, data={"data": texte}, timeout=240,
                                  headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
                if r.status_code == 200:
                    donnees = r.json()
                    if "remark" in donnees and "runtime error" in str(donnees["remark"]):
                        raise ValueError(donnees["remark"])
                    return donnees.get("elements", [])
                print(f"  ! {url} HTTP {r.status_code}", file=sys.stderr)
            except (requests.RequestException, ValueError) as exc:
                print(f"  ! {url} {type(exc).__name__} : {exc}", file=sys.stderr)
        time.sleep(pause * (essai + 1))
    return None


def point(e: dict) -> list | None:
    """[lon × 1e5, lat × 1e5, type, nom, saisonnier, vérifié le] ou None si à écarter."""
    t = e.get("tags") or {}
    if t.get("drinking_water") == "no" or t.get("access") in ("private", "no"):
        return None
    lat = e.get("lat", (e.get("center") or {}).get("lat"))
    lon = e.get("lon", (e.get("center") or {}).get("lon"))
    if lat is None or lon is None:
        return None
    if t.get("amenity") == "drinking_water":
        sorte = 0
    elif t.get("amenity") == "water_point":
        sorte = 1
    else:
        sorte = 2
    saison = t.get("seasonal", "")
    saison = "" if saison in ("", "no") else ("oui" if saison == "yes" else saison)
    verif = t.get("check_date:drinking_water") or t.get("check_date") or t.get("survey:date") or ""
    return [int(round(lon * 1e5)), int(round(lat * 1e5)), sorte, t.get("name", ""), saison, verif[:10]]


def ecrire_case(dossier: Path, la: int, lo: int, elements: list[dict]) -> int:
    vus, pts = set(), []
    for e in elements:
        p = point(e)
        if p and (p[0], p[1]) not in vus:
            vus.add((p[0], p[1]))
            pts.append(p)
    pts.sort()
    (dossier / f"eau_{la}_{lo}.json").write_text(json.dumps(
        {"source": SOURCE, "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "types": list(TYPES), "points": pts}, ensure_ascii=False, separators=(",", ":")))
    return len(pts)


def main(argv=None, interroger=interroger) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sortie", default="resultats/eau")
    p.add_argument("--case", help="lat,lon du coin sud-ouest d'une seule case (essais)")
    p.add_argument("--pause", type=float, default=2, help="secondes entre deux requêtes (serveurs partagés)")
    args = p.parse_args(argv)
    dossier = Path(args.sortie)
    dossier.mkdir(parents=True, exist_ok=True)
    liste = [tuple(int(v) for v in args.case.split(","))] if args.case else cases()
    total, echecs = 0, []
    for la, lo in liste:
        elements = interroger(requete(la, lo))
        if elements is None:
            echecs.append(f"{la},{lo}")
            continue
        n = ecrire_case(dossier, la, lo, elements)
        total += n
        print(f"case {la},{lo} : {n} points d'eau", flush=True)
        time.sleep(args.pause)
    rapport = {"date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "cases": len(liste),
               "points": total, "cases_en_echec": echecs}
    (dossier / "rapport_eau.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(rapport, ensure_ascii=False))
    return 0 if not echecs else 2


if __name__ == "__main__":
    sys.exit(main())
