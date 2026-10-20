#!/usr/bin/env python3
"""Précalcul des côtes sur une zone (jusqu'à un département) dans une base SQLite.

La zone est découpée en tuiles carrées de --tuile mètres. Chaque tuile est calculée comme
cotes_bdtopo.py (tronçons BD TOPO, profils IGN, côtes, revêtement OSM) avec une marge, pour ne
pas couper les côtes qui chevauchent deux tuiles ; seules les côtes dont le départ tombe dans la
tuile sont gardées, et les doublons sont écartés par la base.

La base garde l'état de chaque tuile : on peut relancer après une interruption (--max-tuiles
limite le travail d'un passage, par exemple pour tenir dans un job GitHub Actions).

Exemples :
  python scripts/precalcul.py --zone 48.08,-1.75,48.15,-1.62 --base resultats/base/rennes.sqlite
  python scripts/precalcul.py --zone 48.08,-1.75,48.15,-1.62 --max-tuiles 4   # puis relancer
  python scripts/precalcul.py --cherche 48.1113,-1.68 --rayon 3000 --base resultats/base/rennes.sqlite
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import cotes_bdtopo  # noqa: E402
from trailcotes.base import cotes_proches, enregistrer_tuile, ouvrir, tuile_faite  # noqa: E402
from trailcotes.ign import LOT_DEFAUT, METHODE_DEFAUT, RAYON_TERRE  # noqa: E402


def tuiles(lat_min, lon_min, lat_max, lon_max, cote_m):
    """Centres des tuiles (identifiant, lat, lon, demi-côté en degrés lat / lon)."""
    lat0 = (lat_min + lat_max) / 2
    dlat = math.degrees(cote_m / RAYON_TERRE)
    dlon = math.degrees(cote_m / (RAYON_TERRE * math.cos(math.radians(lat0))))
    ni = max(1, math.ceil((lat_max - lat_min) / dlat))
    nj = max(1, math.ceil((lon_max - lon_min) / dlon))
    for i in range(ni):
        for j in range(nj):
            lat = lat_min + (i + 0.5) * dlat
            lon = lon_min + (j + 0.5) * dlon
            yield f"{cote_m:g}m_{lat:.5f}_{lon:.5f}", lat, lon, dlat / 2, dlon / 2


def precalculer(args) -> int:
    lat_min, lon_min, lat_max, lon_max = (float(v) for v in args.zone.split(","))
    con = ouvrir(args.base)
    liste = list(tuiles(lat_min, lon_min, lat_max, lon_max, args.tuile))
    a_faire = [t for t in liste if not tuile_faite(con, t[0])]
    print(f"{len(liste)} tuiles de {args.tuile / 1000:g} km, {len(a_faire)} à calculer")
    faites, echecs = 0, 0
    for ident, lat, lon, demi_lat, demi_lon in a_faire[:args.max_tuiles or None]:
        print(f"\n== tuile {ident}")
        t0 = time.monotonic()
        params = cotes_bdtopo.parser_arguments([
            "--lat", str(lat), "--lon", str(lon), "--rayon", str(args.tuile / 2 + args.marge),
            "--pente-min", str(args.pente_min), "--taille-lot", str(args.taille_lot), "--methode", args.methode,
            "--decimales", str(args.decimales), "--paralleles", str(args.paralleles),
            "--pause", str(args.pause), "--sans-fond"] + (["--sans-osm"] if args.sans_osm else [])
            + (["--demo"] if args.demo else []))
        try:
            calcul = cotes_bdtopo.calculer(params)
        except Exception as exc:  # une tuile en échec ne bloque pas les autres ; elle sera reprise
            enregistrer_tuile(con, ident, lat, lon, "echec", [], 0, time.monotonic() - t0,
                              {"erreur": f"{type(exc).__name__}: {exc}"})
            echecs += 1
            print(f"  ! {type(exc).__name__}: {exc}", file=sys.stderr)
            continue
        dedans = [c for c in calcul.cotes
                  if abs(c.lat_depart - lat) <= demi_lat and abs(c.lon_depart - lon) <= demi_lon]
        statut = "ok" if calcul.troncons and calcul.taux_valide >= 0.95 else "echec"
        detail = {"troncons": len(calcul.troncons), "points_valides": round(calcul.taux_valide, 4),
                  "codes_alti": calcul.alti.codes_http, "codes_wfs": calcul.wfs.codes_http,
                  "osm": calcul.osm.statut}
        ajoutees = enregistrer_tuile(con, ident, lat, lon, statut, dedans if statut == "ok" else [],
                                     calcul.nb_points, time.monotonic() - t0, detail)
        faites += statut == "ok"
        echecs += statut != "ok"
        print(f"  {statut} : {ajoutees} côtes ajoutées, {calcul.nb_points} points, "
              f"{time.monotonic() - t0:.0f} s")

    total = con.execute("SELECT COUNT(*) FROM cotes").fetchone()[0]
    etat = dict(con.execute("SELECT statut, COUNT(*) FROM tuiles GROUP BY statut").fetchall())
    duree = con.execute("SELECT AVG(duree_s), SUM(points_alti) FROM tuiles WHERE statut = 'ok'").fetchone()
    restantes = len(liste) - etat.get("ok", 0)
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "ok" if echecs == 0 else "echec_partiel",
        "resume": {
            "Zone": args.zone, "Tuiles": f"{etat.get('ok', 0)} faites / {len(liste)} ({restantes} restantes)",
            "Ce passage": f"{faites} tuiles ok, {echecs} en échec",
            "Côtes dans la base": total,
            "Durée moyenne par tuile": f"{(duree[0] or 0):.0f} s",
            "Points altimétriques": duree[1] or 0,
        },
        "parametres": vars(args),
    }
    Path(args.base).with_name("rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(rapport["resume"], ensure_ascii=False, indent=1))
    return 0 if echecs == 0 else 2


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--zone", help="lat_min,lon_min,lat_max,lon_max")
    p.add_argument("--tuile", type=float, default=4000, help="côté des tuiles, en m (défaut 4000)")
    p.add_argument("--marge", type=float, default=500, help="marge autour de chaque tuile, en m (défaut 500)")
    p.add_argument("--max-tuiles", type=int, default=0, help="tuiles calculées par passage (0 : toutes)")
    p.add_argument("--pente-min", type=float, default=5)
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT,
                   help="points par requête altimétrique (défaut %(default)s)")
    p.add_argument("--methode", choices=("GET", "POST", "POST_JSON"), default=METHODE_DEFAUT)
    p.add_argument("--decimales", type=int, default=6)
    p.add_argument("--paralleles", type=int, default=1)
    p.add_argument("--pause", type=float, default=0.25)
    p.add_argument("--sans-osm", action="store_true")
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans appel réseau")
    p.add_argument("--base", default="resultats/base/cotes.sqlite")
    p.add_argument("--cherche", help="lat,lon : affiche les côtes proches dans la base, sans calcul")
    p.add_argument("--rayon", type=float, default=3000, help="rayon de --cherche, en m")
    args = p.parse_args(argv)
    if args.cherche:
        lat, lon = (float(v) for v in args.cherche.split(","))
        for c in cotes_proches(ouvrir(args.base), lat, lon, args.rayon):
            print(f"{c['distance_m']:>6} m  {c['longueur_m']:>5.0f} m à {c['pente_moy_pct']:>4} % "
                  f"(+{c['dplus_m']} m, max {c['pente_max_pct']} %)  {c['type_voie']}, {c['revetement']}  {c['nom']}")
        return 0
    if not args.zone:
        p.error("--zone ou --cherche est requis")
    return precalculer(args)


if __name__ == "__main__":
    sys.exit(main())
