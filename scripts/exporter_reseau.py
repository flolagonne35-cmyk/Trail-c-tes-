#!/usr/bin/env python3
"""Exporte le réseau de voies d'une zone (BD TOPO + altitudes IGN) pour les boucles de l'application.

L'application compose les boucles sur le téléphone, sans réseau : elle a besoin du graphe des
voies praticables à pied, avec pour chaque tronçon sa longueur, son D+ dans les deux sens, son
type (route, chemin, sentier…) et son exposition au trafic.

- Tronçons : WFS BDTOPO_V3:troncon_de_route (mêmes exclusions que les côtes : privés, interdits
  aux piétons, autoroutes, bretelles).
- Altitudes : RGE ALTI, un point tous les --pas mètres le long de chaque tronçon. Sur les ponts
  et dans les tunnels, le terrain n'est pas la voie : le profil y est remplacé par une droite
  entre les deux extrémités.
- Géométrie simplifiée (Douglas-Peucker, --tolerance mètres) et coordonnées entières (1e-5°)
  pour garder un fichier léger.

Un fichier par zone (app/assets/data/reseau/<nom>.reseau, du JSON) : l'application ne charge que
celui de la zone du départ, ce qui garde l'appli légère quand les zones se multiplient.

Exemples :
  python scripts/exporter_reseau.py --nom nantes --zone 47.12,-1.80,47.32,-1.40
  python scripts/exporter_reseau.py --zone 48.07,-1.75,48.16,-1.61 --zone 47.17,-1.80,47.26,-1.50 --sortie /tmp/r.json
  python scripts/exporter_reseau.py --demo --sortie /tmp/reseau.json      # sans réseau
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from trailcotes.bdtopo import TRAFICS, StatsWfs, axes_inverses, lire_troncons, troncons_wfs  # noqa: E402
from trailcotes.geo import Projection, longueurs_cumulees  # noqa: E402
from trailcotes.ign import LOT_DEFAUT, METHODE_DEFAUT, RAYON_TERRE, StatsApi, altitudes_ign  # noqa: E402

TYPES = ("route", "chemin", "sentier", "piste cyclable", "liaison")


def douglas_peucker(xy: np.ndarray, tolerance: float) -> np.ndarray:
    """Indices des sommets gardés (le premier et le dernier toujours)."""
    garder = np.zeros(len(xy), bool)
    garder[0] = garder[-1] = True
    pile = [(0, len(xy) - 1)]
    while pile:
        a, b = pile.pop()
        if b <= a + 1:
            continue
        seg = xy[b] - xy[a]
        n = math.hypot(*seg)
        pts = xy[a + 1:b] - xy[a]
        d = np.abs(seg[0] * pts[:, 1] - seg[1] * pts[:, 0]) / n if n > 0 else np.hypot(pts[:, 0], pts[:, 1])
        k = int(np.argmax(d))
        if d[k] > tolerance:
            garder[a + 1 + k] = True
            pile += [(a, a + 1 + k), (a + 1 + k, b)]
    return np.flatnonzero(garder)


def denivele(z: np.ndarray, seuil: float = 2.0) -> tuple[float, float]:
    """D+ et D− avec hystérésis : on ne compte une variation qu'au-delà de `seuil` mètres (bruit du MNT)."""
    plus = moins = 0.0
    ref = z[0]
    for v in z[1:]:
        if v - ref >= seuil:
            plus += v - ref
            ref = v
        elif ref - v >= seuil:
            moins += ref - v
            ref = v
    return plus, moins


def construire(troncons, proj: Projection, z_points, pas: float, tolerance: float) -> dict:
    """`z_points(x, y)` → altitudes. Renvoie le réseau au format de l'application."""
    noeuds: dict[tuple[float, float], int] = {}

    def noeud(p) -> int:
        cle = (round(float(p[0]), 1), round(float(p[1]), 1))
        if cle not in noeuds:
            noeuds[cle] = len(noeuds)
        return noeuds[cle]

    # échantillons pour les altitudes
    echantillons = []
    for t in troncons:
        c = longueurs_cumulees(t.xy)
        d = np.unique(np.append(np.arange(0.0, c[-1], pas), c[-1]))
        echantillons.append((d, np.interp(d, c, t.xy[:, 0]), np.interp(d, c, t.xy[:, 1])))
    xs = np.concatenate([e[1] for e in echantillons]) if echantillons else np.zeros(0)
    ys = np.concatenate([e[2] for e in echantillons]) if echantillons else np.zeros(0)
    z_tous = z_points(xs, ys)

    noms: dict[str, int] = {}
    aretes = []
    debut = 0
    sans_altitude = 0
    for t, (d, _, _) in zip(troncons, echantillons):
        z = z_tous[debut:debut + len(d)]
        debut += len(d)
        if t.ouvrage or not np.isfinite(z).all():
            if not np.isfinite(z[[0, -1]]).all():
                sans_altitude += 1
                z = np.zeros(len(d))
            else:
                z = np.interp(d, [0, d[-1]], [z[0], z[-1]])
        plus, moins = denivele(z)
        a, b = noeud(t.xy[0]), noeud(t.xy[-1])
        if a == b and t.longueur < 5:
            continue
        idx = douglas_peucker(t.xy, tolerance)[1:-1]
        lon, lat = proj.lonlat(t.xy[idx, 0], t.xy[idx, 1])
        inter = [v for o, a_ in zip(lon, lat) for v in (int(round(o * 1e5)), int(round(a_ * 1e5)))]
        nom = noms.setdefault(t.nom, len(noms)) if t.nom else -1
        aretes.append([a, b, int(round(t.longueur)), round(plus, 1), round(moins, 1), TYPES.index(t.type_voie),
                       TRAFICS.index(t.trafic), nom, inter])

    xy = np.array(list(noeuds.keys())) if noeuds else np.zeros((0, 2))
    lon, lat = proj.lonlat(xy[:, 0], xy[:, 1]) if len(xy) else (np.zeros(0), np.zeros(0))
    return {
        "types": list(TYPES), "trafics": list(TRAFICS),
        "noeuds": [[int(round(o * 1e5)), int(round(a_ * 1e5))] for o, a_ in zip(lon, lat)],
        "aretes": aretes, "noms": list(noms.keys()),
        "_stats": {"noeuds": len(noeuds), "aretes": len(aretes), "points_altitude": int(len(xs)),
                   "points_valides_pct": round(100 * float(np.isfinite(z_tous).mean()), 2) if len(z_tous) else 0,
                   "aretes_sans_altitude": sans_altitude},
    }


def reseau_zone(zone: str, args, wfs: StatsWfs, alti: StatsApi) -> dict:
    """Réseau d'une zone « lat_min,lon_min,lat_max,lon_max »."""
    lat_min, lon_min, lat_max, lon_max = (float(v) for v in zone.split(","))
    lat0, lon0 = (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
    proj = Projection(lat0, lon0)
    demi = max(math.radians(lat_max - lat_min) * RAYON_TERRE, math.radians(lon_max - lon_min) * proj.kx) / 2
    if args.demo:
        import cotes_bdtopo
        features = cotes_bdtopo.reseau_fictif(proj, min(demi, 1600))
        inverse = False

        def z_points(x, y):
            return cotes_bdtopo.relief_xy(x, y)
    else:
        features = troncons_wfs(lat0, lon0, demi, wfs)
        inverse = axes_inverses(features, lat0, lon0)

        def z_points(x, y):
            lon, lat = proj.lonlat(x, y)
            return altitudes_ign(lat, lon, "ign_rge_alti_wld", args.taille_lot, 0.25, 4, alti, args.methode)
    troncons = lire_troncons(features, proj, inverse, wfs)
    print(f"{zone} : {len(troncons)} tronçons retenus sur {len(features)}")
    return construire(troncons, proj, z_points, args.pas, args.tolerance)


def fusionner(reseaux: list[dict]) -> dict:
    """Réseaux de zones distinctes → un seul graphe (numéros de nœuds et de noms décalés)."""
    res = {"types": list(TYPES), "trafics": list(TRAFICS), "noeuds": [], "aretes": [], "noms": []}
    stats: dict = {}
    for r in reseaux:
        dn, dm = len(res["noeuds"]), len(res["noms"])
        res["noeuds"] += r["noeuds"]
        res["noms"] += r["noms"]
        res["aretes"] += [[a + dn, b + dn, L, p, m, t, s, (nom + dm if nom >= 0 else -1), inter]
                          for a, b, L, p, m, t, s, nom, inter in r["aretes"]]
        for k, v in r["_stats"].items():
            stats[k] = stats.get(k, 0) + v if k != "points_valides_pct" else min(stats.get(k, 100), v)
    res["_stats"] = stats
    return res


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--zone", action="append", help="lat_min,lon_min,lat_max,lon_max (répétable : plusieurs zones)")
    p.add_argument("--nom", help="nom de la zone : sortie app/assets/data/reseau/<nom>.reseau")
    p.add_argument("--sortie", help="fichier de sortie (défaut : selon --nom)")
    p.add_argument("--rapport", help="rapport (défaut : resultats/reseau/rapport_<nom>.json)")
    p.add_argument("--pas", type=float, default=25, help="un point d'altitude tous les … m (défaut 25)")
    p.add_argument("--tolerance", type=float, default=4, help="simplification de la géométrie, en m (défaut 4)")
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT)
    p.add_argument("--methode", default=METHODE_DEFAUT)
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans réseau")
    args = p.parse_args(argv)
    zones = args.zone or ["48.075,-1.745,48.150,-1.615"]
    nom = args.nom or "reseau"
    args.sortie = args.sortie or f"app/assets/data/reseau/{nom}.reseau"
    args.rapport = args.rapport or f"resultats/reseau/rapport_{nom}.json"

    t0 = time.monotonic()
    wfs, alti = StatsWfs(), StatsApi()
    reseau = fusionner([reseau_zone(z, args, wfs, alti) for z in zones])
    stats = reseau.pop("_stats")
    reseau = {"nom": nom, "source": "démo" if args.demo else "BD TOPO + RGE ALTI (IGN)",
              "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "zones": [[float(v) for v in z.split(",")] for z in zones], **reseau}
    sortie = Path(args.sortie)
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(reseau, ensure_ascii=False, separators=(",", ":")))
    taille = sortie.stat().st_size
    ok = stats["aretes"] > 0 and stats["points_valides_pct"] >= 95
    rapport = {"date_utc": reseau["date_utc"], "statut": "ok" if ok else "echec", "zones": zones,
               "resume": {**stats, "taille_ko": round(taille / 1024), "duree_s": round(time.monotonic() - t0)},
               "wfs": {k: v for k, v in vars(wfs).items() if k != "exemple_proprietes"} if not args.demo else None,
               "alti": {"requetes": alti.requetes, "codes_http": getattr(alti, "codes_http", {})}}
    Path(args.rapport).parent.mkdir(parents=True, exist_ok=True)
    Path(args.rapport).write_text(json.dumps(rapport, ensure_ascii=False, indent=2, default=str) + "\n")
    print(json.dumps(rapport["resume"], ensure_ascii=False))
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
