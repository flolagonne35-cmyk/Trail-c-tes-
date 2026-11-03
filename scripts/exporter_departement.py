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
import sqlite3
import sys
from pathlib import Path

import numpy as np

CHAMPS = ("longueur_m", "pente_moy_pct", "pente_max_pct", "dplus_m", "alt_depart_m", "alt_arrivee_m",
          "type_voie", "nom", "revetement", "technicite", "adresse", "trafic")


def alleger(valeurs: list, n_max: int) -> list:
    if len(valeurs) <= n_max:
        return valeurs
    idx = np.unique(np.linspace(0, len(valeurs) - 1, n_max).round().astype(int))
    return [valeurs[i] for i in idx]


def cote_app(i: int, props: dict, profil: dict, geometrie: list) -> dict:
    d, z = profil.get("d_m", []), profil.get("z_m", [])
    garder = alleger(list(range(len(d))), 80)
    return {
        "id": i,
        "lat": round(geometrie[0][1], 6), "lon": round(geometrie[0][0], 6),
        **{k: props.get(k) or ("" if k in ("nom", "revetement", "technicite", "adresse", "trafic") else 0) for k in CHAMPS},
        "pentes_50m": props.get("pentes_50m") or [],
        "profil": {"d": [round(d[k], 1) for k in garder], "z": [round(z[k], 1) for k in garder]},
        "geometrie": [[round(lon, 6), round(lat, 6)] for lon, lat in alleger(geometrie, 50)],
    }


def depuis_base(chemin: Path, premier_id: int = 1) -> tuple[list[dict], dict | None]:
    """Côtes d'une base, et la zone couverte (emprise des tuiles calculées)."""
    con = sqlite3.connect(chemin)
    con.row_factory = sqlite3.Row
    cotes = []
    for i, r in enumerate(con.execute("SELECT * FROM cotes ORDER BY id"), start=premier_id):
        props = dict(r)
        props["pentes_50m"] = json.loads(props["pentes_50m"])
        cotes.append(cote_app(i, props, json.loads(r["profil"]), json.loads(r["geometrie"])))
    t = con.execute("SELECT MIN(lat), MIN(lon), MAX(lat), MAX(lon), COUNT(*) FROM tuiles WHERE statut = 'ok'").fetchone()
    zone = None
    if t[4]:
        zone = {"nom": chemin.stem, "lat": round((t[0] + t[2]) / 2, 4),
                "lon": round((t[1] + t[3]) / 2, 4), "cotes": len(cotes),
                "emprise": [round(t[0], 3), round(t[1], 3), round(t[2], 3), round(t[3], 3)]}
    return cotes, zone



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
