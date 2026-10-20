#!/usr/bin/env python3
"""Liste de toutes les communes de France (nom, codes postaux, département, centre, population),
pour la recherche de ville hors ligne dans l'application.

Source : API Découpage administratif (geo.api.gouv.fr), Licence Ouverte Etalab 2.0.
Sortie compacte : app/assets/data/communes.json = {"source", "date", "communes": [[nom, cp, dep, lat, lon, pop], …]}
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

URL = "https://geo.api.gouv.fr/communes"


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sortie", default="app/assets/data/communes.json")
    args = p.parse_args(argv)
    r = requests.get(URL, params={"fields": "nom,codesPostaux,codeDepartement,centre,population", "format": "json"},
                     timeout=120, headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
    r.raise_for_status()
    communes = []
    for c in r.json():
        coords = (c.get("centre") or {}).get("coordinates")
        if not coords:
            continue
        cps = c.get("codesPostaux") or [""]
        communes.append([c["nom"], cps[0], c.get("codeDepartement", ""), round(coords[1], 4), round(coords[0], 4),
                         c.get("population") or 0])
    communes.sort(key=lambda c: -c[5])  # les plus peuplées d'abord : meilleures suggestions à égalité
    if len(communes) < 30000:
        print(f"ÉCHEC : seulement {len(communes)} communes reçues", file=sys.stderr)
        return 2
    sortie = Path(args.sortie)
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps({"source": "geo.api.gouv.fr (Licence Ouverte)",
                                  "date": datetime.now(timezone.utc).date().isoformat(),
                                  "communes": communes}, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(communes)} communes, {sortie.stat().st_size / 1e6:.1f} Mo → {sortie}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
