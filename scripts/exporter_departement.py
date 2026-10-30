#!/usr/bin/env python3
"""Exporte les côtes d'un département (base de precalcul.py --departement) pour l'application.

Un fichier par département (cotes_<code>.json), servi avec la version web (Cloudflare Pages) :
l'application ne charge que les départements autour du point de départ. Les identifiants sont
uniques dans toute la France (code du département × 1 000 000 + numéro dans la base).

  python scripts/exporter_departement.py --departement 35 --base resultats/base/dep_35.sqlite --sortie /tmp/cotes
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exporter_app import alleger, depuis_base  # noqa: E402

# un fichier ne doit pas dépasser 25 Mo sur Cloudflare Pages : profil et tracé allégés, et au plus
# PAR_FICHIER côtes par fichier (cotes_35.json, cotes_35_2.json…)
PAR_FICHIER = 6000


def numero(dep: str) -> int:
    """35 → 35, 2A → 200, 2B → 201, 974 → 974 : préfixe des identifiants de côtes."""
    return {"2A": 200, "2B": 201}.get(dep.upper(), None) or int(dep)


def alleger_cote(c: dict) -> dict:
    garder = alleger(list(range(len(c["profil"]["d"]))), 40)
    return {**c, "profil": {"d": [c["profil"]["d"][k] for k in garder], "z": [c["profil"]["z"][k] for k in garder]},
            "geometrie": alleger(c["geometrie"], 30)}


def exporter(dep: str, base: Path, sortie: Path) -> dict:
    cotes, zone = depuis_base(base, numero(dep) * 1_000_000 + 1)
    cotes = [alleger_cote(c) for c in cotes]
    sortie.mkdir(parents=True, exist_ok=True)
    emprise = zone["emprise"] if zone else None
    fichiers = []
    for k in range(max(1, -(-len(cotes) // PAR_FICHIER))):
        nom = f"cotes_{dep}.json" if k == 0 else f"cotes_{dep}_{k + 1}.json"
        morceau = cotes[k * PAR_FICHIER:(k + 1) * PAR_FICHIER]
        (sortie / nom).write_text(json.dumps({"departement": dep, "emprise": emprise, "nombre": len(morceau), "cotes": morceau},
                                             ensure_ascii=False, separators=(",", ":")))
        fichiers.append(nom)
    return {"departement": dep, "emprise": emprise, "nombre": len(cotes), "fichiers": fichiers}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--departement", required=True)
    p.add_argument("--base", type=Path, required=True)
    p.add_argument("--sortie", type=Path, default=Path("resultats/departements"))
    args = p.parse_args(argv)
    print(json.dumps(exporter(args.departement, args.base, args.sortie), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
