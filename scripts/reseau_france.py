#!/usr/bin/env python3
"""Réseau des voies pour les boucles, département par département (France entière).

Même grille que les côtes (tuiles de 4 km, scripts/precalcul.py) : pour chaque tuile, les tronçons
BD TOPO (mêmes exclusions : privés, interdits aux piétons, autoroutes) et leur D+ dans les deux
sens (RGE ALTI, un point tous les --pas mètres ; ponts et tunnels en ligne droite). Un tronçon
appartient à la tuile qui contient son milieu : pas de doublon entre tuiles, et les extrémités en
coordonnées entières (1e-5°) raccordent les tuiles entre elles dans l'appli.

La base SQLite garde l'état de chaque tuile (reprise après coupure, --duree-max). L'export écrit un
fichier par bloc de 3 × 3 tuiles (≈ 12 km) : l'appli ne charge que les blocs autour du départ, à
la distance utile pour la boucle demandée.

Exemples :
  python scripts/reseau_france.py --departement 35 --duree-max 240
  python scripts/reseau_france.py --departement 35 --exporter resultats/reseau_france
  python scripts/reseau_france.py --zone 48.10,-1.70,48.13,-1.65 --demo --exporter /tmp/r   # sans réseau
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import exporter_reseau as er  # noqa: E402
import precalcul  # noqa: E402
from trailcotes.bdtopo import StatsWfs, axes_inverses, lire_troncons, troncons_wfs  # noqa: E402
from trailcotes.geo import Projection, longueurs_cumulees  # noqa: E402
from trailcotes.ign import LOT_DEFAUT, METHODE_DEFAUT, StatsApi, altitudes_ign  # noqa: E402

BLOC = 3  # tuiles par côté d'un fichier exporté (3 × 4 km = 12 km)
TAILLE_MAX = 20_000_000  # octets ; Cloudflare Pages refuse les fichiers de plus de 25 Mio

SCHEMA = """
CREATE TABLE IF NOT EXISTS tuiles (
    id TEXT PRIMARY KEY, lat REAL, lon REAL, demi_lat REAL, demi_lon REAL, statut TEXT,
    nb_aretes INTEGER, points_alti INTEGER, duree_s REAL, date_utc TEXT, detail TEXT, aretes TEXT
);
"""
STATUTS_FAITS = ("ok", "vide")


def ouvrir(chemin) -> sqlite3.Connection:
    Path(chemin).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(chemin)
    con.executescript(SCHEMA)
    return con


def milieu(xy: np.ndarray) -> np.ndarray:
    c = longueurs_cumulees(xy)
    return np.array([np.interp(c[-1] / 2, c, xy[:, 0]), np.interp(c[-1] / 2, c, xy[:, 1])])


def calculer_tuile(lat, lon, demi_lat, demi_lon, args):
    """Arêtes de la tuile (tronçons dont le milieu est dedans), statut et détail."""
    proj = Projection(lat, lon)
    rayon = max(math.radians(demi_lat) * 6371008.8, math.radians(demi_lon) * proj.kx) + 50
    wfs, alti = StatsWfs(), StatsApi()
    if args.demo:
        import cotes_bdtopo
        features, inverse = cotes_bdtopo.reseau_fictif(proj, rayon), False

        def z_points(x, y):
            return cotes_bdtopo.relief_xy(x, y)
    else:
        features = troncons_wfs(lat, lon, rayon, wfs)
        inverse = axes_inverses(features, lat, lon)

        def z_points(x, y):
            lo, la = proj.lonlat(x, y)
            return altitudes_ign(la, lo, "ign_rge_alti_wld", args.taille_lot, 0.25, 4, alti, args.methode)
    troncons = lire_troncons(features, proj, inverse, wfs)
    a_moi = []
    for t in troncons:
        lo, la = proj.lonlat(*milieu(t.xy))
        if lat - demi_lat <= float(la) < lat + demi_lat and lon - demi_lon <= float(lo) < lon + demi_lon:
            a_moi.append(t)
    if not a_moi:
        return [], ("echec" if wfs.erreurs else "vide"), {"troncons": len(troncons), "codes_wfs": wfs.codes_http}
    aretes, stats = er.aretes_brutes(a_moi, proj, z_points, args.pas, args.tolerance)
    statut = "echec" if wfs.erreurs or alti.lots_en_echec else "ok"
    return aretes, statut, {"troncons": len(a_moi), "codes_wfs": wfs.codes_http,
                            "codes_alti": alti.codes_http, **stats}


def bloc_de(ident: str) -> tuple[int, int] | None:
    m = re.fullmatch(r"g\d+_(-?\d+)_(-?\d+)", ident)
    return (int(m.group(1)) // BLOC, int(m.group(2)) // BLOC) if m else None


def exporter(con, code: str, dossier: Path) -> dict:
    """Un fichier par bloc de BLOC × BLOC tuiles, et un index du département (emprise, nœuds, fichier)."""
    dossier.mkdir(parents=True, exist_ok=True)
    blocs: dict[tuple, dict[str, list]] = {}
    for ident, aretes in con.execute("SELECT id, aretes FROM tuiles WHERE statut = 'ok' ORDER BY id"):
        blocs.setdefault(bloc_de(ident) or (0, 0), {})[ident] = json.loads(aretes)
    index = []

    def ecrire(nom: str, aretes: list) -> str | None:
        r = er.indexer(aretes)
        if not r["aretes"]:
            return ""
        lons = [n[0] for n in r["noeuds"]] + [v for a in r["aretes"] for v in a[8][0::2]]
        lats = [n[1] for n in r["noeuds"]] + [v for a in r["aretes"] for v in a[8][1::2]]
        emprise = [min(lats) / 1e5, min(lons) / 1e5, max(lats) / 1e5, max(lons) / 1e5]
        texte = json.dumps({"source": "BD TOPO + RGE ALTI (IGN)", "emprise": emprise, **r},
                           ensure_ascii=False, separators=(",", ":"))
        if len(texte) > TAILLE_MAX:
            return None
        (dossier / nom).write_text(texte)
        index.append({"f": nom, "e": [round(v, 5) for v in emprise], "n": len(r["noeuds"])})
        return nom

    for (bi, bj), tuiles in sorted(blocs.items()):
        if ecrire(f"reseau_{code}_{bi}_{bj}.json", [a for t in tuiles.values() for a in t]) is None:
            # grande ville trop dense pour un seul fichier : un fichier par tuile de 4 km
            for ident, aretes in tuiles.items():
                ecrire(f"reseau_{code}_{ident}.json", aretes)
    (dossier / f"reseau_{code}.index.json").write_text(json.dumps(index, separators=(",", ":")))
    return {"departement": code, "fichiers": len(index), "noeuds": sum(i["n"] for i in index)}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--departement", help="code du département (grille France)")
    p.add_argument("--zone", help="lat_min,lon_min,lat_max,lon_max (essais)")
    p.add_argument("--base", help="défaut : resultats/reseau_base/res_<dep>.sqlite")
    p.add_argument("--duree-max", type=float, default=0, help="minutes ; la suite au passage suivant")
    p.add_argument("--exporter", help="dossier : écrit les fichiers de l'appli au lieu de calculer")
    p.add_argument("--pas", type=float, default=25, help="un point d'altitude tous les … m (défaut 25)")
    p.add_argument("--tolerance", type=float, default=4, help="simplification de la géométrie, en m")
    p.add_argument("--tuile", type=float, default=4000)
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT)
    p.add_argument("--methode", default=METHODE_DEFAUT)
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans réseau")
    args = p.parse_args(argv)
    code = args.departement or "zone"
    args.base = args.base or f"resultats/reseau_base/res_{code}.sqlite"
    con = ouvrir(args.base)

    if args.exporter:
        print(json.dumps(exporter(con, code, Path(args.exporter)), ensure_ascii=False))
        return 0

    if args.departement:
        liste = list(precalcul.tuiles_departement(args.departement, args.tuile))
    else:
        lat_min, lon_min, lat_max, lon_max = (float(v) for v in args.zone.split(","))
        lat0, lon0 = precalcul.ORIGINE_GRILLE
        dlat = math.degrees(args.tuile / precalcul.RAYON_TERRE)
        liste = []
        for i in range(math.floor((lat_min - lat0) / dlat), math.floor((lat_max - lat0) / dlat) + 1):
            lat = lat0 + (i + 0.5) * dlat
            dlon = math.degrees(args.tuile / (precalcul.RAYON_TERRE * math.cos(math.radians(lat))))
            for j in range(math.floor((lon_min - lon0) / dlon), math.floor((lon_max - lon0) / dlon) + 1):
                liste.append((f"g{args.tuile:g}_{i}_{j}", lat, lon0 + (j + 0.5) * dlon, dlat / 2, dlon / 2))
    faites = {r[0] for r in con.execute("SELECT id FROM tuiles WHERE statut IN ('ok', 'vide')")}
    a_faire = [t for t in liste if t[0] not in faites]
    print(f"{len(liste)} tuiles, {len(a_faire)} à calculer")
    debut, ok, echecs = time.monotonic(), 0, 0
    for ident, lat, lon, demi_lat, demi_lon in a_faire:
        if args.duree_max and time.monotonic() - debut > args.duree_max * 60:
            print(f"Durée maximale atteinte ({args.duree_max:g} min) : la suite au prochain passage.")
            break
        t0 = time.monotonic()
        try:
            aretes, statut, detail = calculer_tuile(lat, lon, demi_lat, demi_lon, args)
        except Exception as exc:  # une tuile en échec ne bloque pas les autres
            aretes, statut, detail = [], "echec", {"erreur": f"{type(exc).__name__}: {exc}"}
        con.execute("INSERT OR REPLACE INTO tuiles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (ident, lat, lon, demi_lat, demi_lon, statut, len(aretes), detail.get("points_altitude", 0),
                     round(time.monotonic() - t0, 1), datetime.now(timezone.utc).isoformat(timespec="seconds"),
                     json.dumps(detail, default=str), json.dumps(aretes, separators=(",", ":"))))
        con.commit()
        ok += statut != "echec"
        echecs += statut == "echec"
        print(f"{ident} : {statut}, {len(aretes)} arêtes, {time.monotonic() - t0:.0f} s", flush=True)

    etat = dict(con.execute("SELECT statut, COUNT(*) FROM tuiles GROUP BY statut").fetchall())
    finies = etat.get("ok", 0) + etat.get("vide", 0)
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "resume": {
            "Zone": f"département {args.departement}" if args.departement else args.zone,
            "Tuiles": f"{finies} faites / {len(liste)} ({len(liste) - finies} restantes)",
            "Ce passage": f"{ok} tuiles ok, {echecs} en échec",
            "Arêtes dans la base": con.execute("SELECT COALESCE(SUM(nb_aretes), 0) FROM tuiles WHERE statut = 'ok'").fetchone()[0],
        },
    }
    Path(args.base).with_name(f"rapport_{Path(args.base).stem}.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(rapport["resume"], ensure_ascii=False))
    return 0 if echecs == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
