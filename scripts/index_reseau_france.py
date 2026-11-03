#!/usr/bin/env python3
"""Écrit index.json à côté des fichiers reseau_<dep>_<bloc>.json (réseau des boucles, France) : la
liste des blocs avec leur emprise et leur nombre de carrefours. L'appli le lit pour ne charger que
les blocs autour du départ.

  python scripts/index_reseau_france.py app/dist/reseau
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def index(dossier: Path) -> dict:
    blocs = []
    for f in sorted(dossier.glob("reseau_*.index.json")):
        blocs += [b for b in json.loads(f.read_text()) if (dossier / b["f"]).exists()]
    return {"blocs": blocs}


def main(argv=None) -> int:
    dossier = Path((argv or sys.argv[1:] or ["app/dist/reseau"])[0])
    dossier.mkdir(parents=True, exist_ok=True)
    i = index(dossier)
    (dossier / "index.json").write_text(json.dumps(i, separators=(",", ":")))
    print(f"{len(i['blocs'])} blocs, {sum(b['n'] for b in i['blocs'])} carrefours")
    return 0


if __name__ == "__main__":
    sys.exit(main())
