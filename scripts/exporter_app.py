#!/usr/bin/env python3
"""Exporte les côtes et un parcours de démonstration au format lu par l'application (app/).

Source des côtes : une base SQLite de precalcul.py (--base) ou, à défaut, un cotes.geojson de
cotes_bdtopo.py (--geojson). La géométrie et le profil sont allégés (≤ 80 et ≤ 120 points) pour
que le fichier reste léger dans l'application.

Exemple :
  python scripts/exporter_app.py --base resultats/base/rennes.sqlite \\
      --parcours resultats/parcours_ventoux/parcours.json
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


# nom affiché de chaque zone, d'après le nom de sa base (resultats/base/<nom>.sqlite)
NOMS_ZONES = {"rennes": "Rennes Métropole", "nantes": "Nantes Métropole"}


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
        zone = {"nom": NOMS_ZONES.get(chemin.stem, chemin.stem.capitalize()), "lat": round((t[0] + t[2]) / 2, 4),
                "lon": round((t[1] + t[3]) / 2, 4), "cotes": len(cotes),
                "emprise": [round(t[0], 3), round(t[1], 3), round(t[2], 3), round(t[3], 3)]}
    return cotes, zone


def depuis_geojson(chemin: Path) -> list[dict]:
    feats = json.loads(chemin.read_text())["features"]
    cotes = []
    for f in feats:
        if f["geometry"]["type"] != "LineString":
            continue
        p = f["properties"]
        cotes.append(cote_app(len(cotes) + 1, p, p.get("profil", {}), f["geometry"]["coordinates"]))
    return cotes


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--base", type=Path, nargs="+", help="bases SQLite de precalcul.py (une par zone)")
    p.add_argument("--geojson", type=Path, default=Path("resultats/rennes_cotes/cotes.geojson"))
    p.add_argument("--parcours", type=Path, help="parcours.json de segmenter_gpx.py (démonstration)")
    p.add_argument("--sortie", type=Path, default=Path("app/assets/data"))
    args = p.parse_args(argv)
    args.sortie.mkdir(parents=True, exist_ok=True)

    bases = [b for b in args.base or [] if b.exists()]
    zones: list[dict] = []
    if bases:
        cotes = []
        for b in sorted(bases):
            c, zone = depuis_base(b, len(cotes) + 1)
            cotes += c
            if zone:
                zones.append(zone)
        source = ", ".join(str(b) for b in sorted(bases))
    else:
        cotes, source = depuis_geojson(args.geojson), str(args.geojson)
    (args.sortie / "cotes.json").write_text(json.dumps({"source": source, "zones": zones, "cotes": cotes}, ensure_ascii=False,
                                                        separators=(",", ":")) + "\n")
    print(f"{len(cotes)} côtes exportées depuis {source}")
    if args.parcours and args.parcours.exists():
        (args.sortie / "parcours_demo.json").write_text(args.parcours.read_text())
        print(f"parcours de démonstration : {args.parcours}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
