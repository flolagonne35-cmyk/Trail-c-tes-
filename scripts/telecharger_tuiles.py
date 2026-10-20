#!/usr/bin/env python3
"""Télécharge les tuiles du Plan IGN (WMTS Géoplateforme, pyramide PM) d'une zone, pour un usage hors ligne.

Utile pour la version de test de l'application, qui ne peut pas joindre data.geopf.fr : les tuiles
sont publiées avec la page. L'application réelle charge les tuiles en direct.

Sortie : <sortie>/<z>/<x>/<y>.png et <sortie>/rapport.json.

Exemple :
  python scripts/telecharger_tuiles.py --zone 48.070,-1.745,48.155,-1.595 --zooms 11-15 \\
      --sortie resultats/tuiles/rennes
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

WMTS = ("https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0"
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png"
        "&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}")


def tuile(lat: float, lon: float, z: int) -> tuple[int, int]:
    """Numéro (x, y) de la tuile Web Mercator contenant le point."""
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def tuiles_zone(lat_min, lon_min, lat_max, lon_max, zooms):
    for z in zooms:
        x0, y0 = tuile(lat_max, lon_min, z)
        x1, y1 = tuile(lat_min, lon_max, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                yield z, x, y


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--zone", default="48.070,-1.745,48.155,-1.595", help="lat_min,lon_min,lat_max,lon_max")
    p.add_argument("--zooms", default="11-15", help="ex. 11-15")
    p.add_argument("--sortie", default="resultats/tuiles/rennes")
    p.add_argument("--pause", type=float, default=0.05)
    args = p.parse_args(argv)
    lat_min, lon_min, lat_max, lon_max = (float(v) for v in args.zone.split(","))
    a, b = (int(v) for v in args.zooms.split("-"))
    sortie = Path(args.sortie)
    session = requests.Session()
    session.headers["User-Agent"] = "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"
    ok, deja, erreurs, octets = 0, 0, [], 0
    for z, x, y in tuiles_zone(lat_min, lon_min, lat_max, lon_max, range(a, b + 1)):
        chemin = sortie / str(z) / str(x) / f"{y}.png"
        if chemin.exists() and chemin.stat().st_size > 0:
            deja += 1
            continue
        try:
            r = session.get(WMTS.format(z=z, x=x, y=y), timeout=30)
            if r.status_code == 200 and r.headers.get("Content-Type", "").startswith("image/"):
                chemin.parent.mkdir(parents=True, exist_ok=True)
                chemin.write_bytes(r.content)
                ok += 1
                octets += len(r.content)
            else:
                erreurs.append(f"{z}/{x}/{y} HTTP {r.status_code} {r.headers.get('Content-Type')} {r.text[:120]}")
        except requests.RequestException as exc:
            erreurs.append(f"{z}/{x}/{y} {type(exc).__name__}: {exc}")
        time.sleep(args.pause)
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "ok" if not erreurs else "echec_partiel",
        "resume": {"Tuiles téléchargées": ok, "Déjà présentes": deja, "Erreurs": len(erreurs),
                   "Taille téléchargée": f"{octets / 1e6:.1f} Mo", "Zooms": args.zooms, "Zone": args.zone},
        "erreurs": erreurs[:20],
        "source": "Plan IGN v2, WMTS Géoplateforme (Licence Ouverte Etalab 2.0)",
    }
    sortie.mkdir(parents=True, exist_ok=True)
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(rapport["resume"], ensure_ascii=False))
    for e in erreurs[:5]:
        print("  ! " + e, file=sys.stderr)
    return 0 if not erreurs else 2


if __name__ == "__main__":
    sys.exit(main())
