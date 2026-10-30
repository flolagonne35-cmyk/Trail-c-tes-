#!/usr/bin/env python3
"""Précalcul des côtes sur une zone (jusqu'à un département) dans une base SQLite.

La zone est découpée en tuiles carrées de --tuile mètres. Chaque tuile est calculée comme
cotes_bdtopo.py (tronçons BD TOPO, profils IGN, côtes, revêtement OSM) avec une marge, pour ne
pas couper les côtes qui chevauchent deux tuiles ; seules les côtes dont le départ tombe dans la
tuile sont gardées, et les doublons sont écartés par la base.

La base garde l'état de chaque tuile : on peut relancer après une interruption (--max-tuiles
limite le travail d'un passage, par exemple pour tenir dans un job GitHub Actions).

France entière : --departement 35 découpe le département sur une grille commune à toute la France
(tuiles de 4 km, attribuées au département de la commune la plus proche de leur centre) ;
--duree-max arrête de lancer des tuiles au bout de N minutes, le passage suivant reprend.

Exemples :
  python scripts/precalcul.py --departement 35 --duree-max 300
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
from trailcotes.adresses import completer_adresses  # noqa: E402
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


# grille de la France entière : même découpage pour tous les départements (pas de recouvrement)
ORIGINE_GRILLE = (40.0, -6.0)
# départements couverts par les données IGN (métropole et départements d'outre-mer)
DEPARTEMENTS = [f"{i:02d}" for i in range(1, 96) if i != 20] + ["2A", "2B", "971", "972", "973", "974", "976"]
COMMUNES = Path(__file__).resolve().parents[1] / "app/assets/data/communes.json"


def tuiles_departement(dep: str, cote_m: float, communes: list | None = None):
    """Tuiles de la grille France dont le centre est plus proche d'une commune du département
    que de toute autre commune (et à moins de 8 km d'une commune : pas de tuile en pleine mer)."""
    from scipy.spatial import cKDTree
    import numpy as np
    communes = communes if communes is not None else json.loads(COMMUNES.read_text())["communes"]
    lat0, lon0 = ORIGINE_GRILLE
    dlat = math.degrees(cote_m / RAYON_TERRE)
    pts = np.array([[c[3], c[4]] for c in communes])
    deps = [c[2] for c in communes]
    # distances approchées en km (longitude réduite par le cosinus de la latitude)
    def xy(lat, lon):
        return np.column_stack([np.asarray(lat) * 111.2, np.asarray(lon) * 111.2 * np.cos(np.radians(np.asarray(lat)))])
    arbre = cKDTree(xy(pts[:, 0], pts[:, 1]))
    miennes = pts[[d == dep for d in deps]]
    if not len(miennes):
        return
    i_min = math.floor((miennes[:, 0].min() - lat0) / dlat) - 2
    i_max = math.floor((miennes[:, 0].max() - lat0) / dlat) + 2
    for i in range(i_min, i_max + 1):
        lat = lat0 + (i + 0.5) * dlat
        dlon = math.degrees(cote_m / (RAYON_TERRE * math.cos(math.radians(lat))))
        j_min = math.floor((miennes[:, 1].min() - lon0) / dlon) - 2
        j_max = math.floor((miennes[:, 1].max() - lon0) / dlon) + 2
        lons = lon0 + (np.arange(j_min, j_max + 1) + 0.5) * dlon
        dist, idx = arbre.query(xy(np.full(len(lons), lat), lons))
        for j, lon, d, k in zip(range(j_min, j_max + 1), lons, dist, idx):
            if deps[k] == dep and d <= 8:
                yield f"g{cote_m:g}_{i}_{j}", lat, float(lon), dlat / 2, dlon / 2


def precalculer(args) -> int:
    con = ouvrir(args.base)
    if args.departement:
        liste = list(tuiles_departement(args.departement, args.tuile))
        args.zone = f"département {args.departement}"
    else:
        lat_min, lon_min, lat_max, lon_max = (float(v) for v in args.zone.split(","))
        liste = list(tuiles(lat_min, lon_min, lat_max, lon_max, args.tuile))
    debut = time.monotonic()
    a_faire = [t for t in liste if not tuile_faite(con, t[0])]
    print(f"{len(liste)} tuiles de {args.tuile / 1000:g} km, {len(a_faire)} à calculer")
    faites, echecs = 0, 0
    for ident, lat, lon, demi_lat, demi_lon in a_faire[:args.max_tuiles or None]:
        if args.duree_max and time.monotonic() - debut > args.duree_max * 60:
            print(f"\nDurée maximale atteinte ({args.duree_max:g} min) : la suite au prochain passage.")
            break
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

    adresses = (0, 0)
    if not args.demo and not args.sans_adresses:
        print("\nAdresses des pieds de côtes (géocodage inverse IGN)…")
        adresses = completer_adresses(con)
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
            "Adresses trouvées / en échec (ce passage)": f"{adresses[0]} / {adresses[1]}",
            "Durée moyenne par tuile": f"{(duree[0] or 0):.0f} s",
            "Points altimétriques": duree[1] or 0,
        },
        "parametres": vars(args),
    }
    Path(args.base).with_name(f"rapport_{Path(args.base).stem}.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(rapport["resume"], ensure_ascii=False, indent=1))
    return 0 if echecs == 0 else 2


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--zone", help="lat_min,lon_min,lat_max,lon_max")
    p.add_argument("--departement", help="code du département (35, 2A, 974…) : grille France, base resultats/base/dep_<code>.sqlite")
    p.add_argument("--duree-max", type=float, default=0, help="minutes : n'entame plus de tuile au-delà (0 : sans limite)")
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
    p.add_argument("--sans-adresses", action="store_true", help="ne pas chercher l'adresse du pied des côtes")
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans appel réseau")
    p.add_argument("--base", help="base SQLite (défaut : resultats/base/dep_<code>.sqlite ou resultats/base/cotes.sqlite)")
    p.add_argument("--cherche", help="lat,lon : affiche les côtes proches dans la base, sans calcul")
    p.add_argument("--rayon", type=float, default=3000, help="rayon de --cherche, en m")
    args = p.parse_args(argv)
    args.base = args.base or (f"resultats/base/dep_{args.departement}.sqlite" if args.departement else "resultats/base/cotes.sqlite")
    if args.cherche:
        lat, lon = (float(v) for v in args.cherche.split(","))
        for c in cotes_proches(ouvrir(args.base), lat, lon, args.rayon):
            print(f"{c['distance_m']:>6} m  {c['longueur_m']:>5.0f} m à {c['pente_moy_pct']:>4} % "
                  f"(+{c['dplus_m']} m, max {c['pente_max_pct']} %)  {c['type_voie']}, {c['revetement']}  {c['nom']}")
        return 0
    if not args.zone and not args.departement:
        p.error("--zone, --departement ou --cherche est requis")
    return precalculer(args)


if __name__ == "__main__":
    sys.exit(main())
