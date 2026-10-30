#!/usr/bin/env python3
"""Écrit index.json à côté des fichiers cotes_<dep>*.json : pour chaque département, son emprise,
son nombre de côtes et ses fichiers. L'application le lit pour savoir quoi charger autour du départ.

  python scripts/index_departements.py app/dist/cotes
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def index(dossier: Path) -> dict:
    deps: dict[str, dict] = {}
    for f in sorted(dossier.glob("cotes_*.json")):
        m = re.fullmatch(r"cotes_([0-9AB]+)(?:_(\d+))?\.json", f.name)
        if not m:
            continue
        d = json.loads(f.read_text())
        e = deps.setdefault(m.group(1), {"emprise": d.get("emprise"), "nombre": 0, "fichiers": []})
        e["nombre"] += d.get("nombre", 0)
        e["fichiers"].append(f.name)
    return {"departements": {k: v for k, v in deps.items() if v["nombre"] and v["emprise"]}}


def main(argv=None) -> int:
    dossier = Path((argv or sys.argv[1:] or ["app/dist/cotes"])[0])
    i = index(dossier)
    (dossier / "index.json").write_text(json.dumps(i, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(i['departements'])} départements, {sum(v['nombre'] for v in i['departements'].values())} côtes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
