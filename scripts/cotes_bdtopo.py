#!/usr/bin/env python3
"""Côtes réelles le long des chemins et routes BD TOPO, avec les altitudes RGE ALTI de l'IGN.

Étapes :
  1. tronçons BD TOPO (couche troncon_de_route) dans un carré autour du point, via le WFS
     de la Géoplateforme ;
  2. raccordement des tronçons en voies continues (même type de voie, sans virage > 45°
     aux intersections) ;
  3. un point tous les --pas mètres le long de chaque voie, altitude IGN (les ponts et
     tunnels sont interpolés entre leurs extrémités : le MNT donne le sol dessous) ;
  4. lissage du profil, découpage en montées (dans un sens ou dans l'autre), rognage des
     bouts plats, coupure aux replats ;
  5. position de l'utilisateur accrochée au tronçon le plus proche, distance à chaque côte
     par le réseau (à pied : les sens interdits ne comptent pas ; les voies privées ou
     interdites aux piétons sont exclues) ;
  6. revêtement et technicité de chaque côte d'après OpenStreetMap (surface, smoothness,
     sac_scale), à défaut déduits de la nature BD TOPO ; fond de carte Plan IGN.

Sorties (dans --sortie) :
  cotes.csv      une côte par ligne : distance, longueur, pentes, D+, type de voie, nom, pentes / 50 m
  cotes.geojson  géométrie et profil de chaque côte, et la position accrochée
  carte.png      réseau, côtes colorées par pente, numérotées par distance
  rapport.json   paramètres, statistiques WFS et altimétrie, erreurs

Code de sortie : 0 si tout va bien, 2 si le WFS ne renvoie rien ou si trop de points
n'ont pas d'altitude, 1 pour une erreur inattendue.

Exemple :
  python scripts/cotes_bdtopo.py --lat 48.1113 --lon -1.6800 --rayon 2000
  python scripts/cotes_bdtopo.py --demo        # réseau et relief fictifs, sans réseau
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trailcotes.bdtopo import (  # noqa: E402
    COUCHE, TRAFICS, Reseau, StatsWfs, Troncon, Voie, axes_inverses, chainer,
    echantillonner, lire_troncons, troncons_wfs,
)
from trailcotes.geo import Projection  # noqa: E402
from trailcotes.ign import (  # noqa: E402
    LOT_DEFAUT, METHODE_DEFAUT, RENNES_LAT, RENNES_LON, RESSOURCE_DEFAUT, StatsApi, altitudes_ign,
)
from trailcotes.osm import StatsOsm, fond_plan_ign, qualifier_revetement, voies_osm  # noqa: E402
from trailcotes.profil import boucher_et_lisser, montees, pentes_par_tranche  # noqa: E402


# --------------------------------------------------------------------------- géométrie


# --------------------------------------------------------------------------- WFS BD TOPO


# --------------------------------------------------------------------------- réseau


# --------------------------------------------------------------------------- profil et côtes


@dataclass
class Cote:
    id: int
    distance_m: float
    longueur_m: float
    pente_moy_pct: float
    pente_max_pct: float
    dplus_m: float
    alt_depart_m: float
    alt_arrivee_m: float
    type_voie: str
    nature: str
    nom: str
    lat_depart: float
    lon_depart: float
    lat_arrivee: float
    lon_arrivee: float
    pentes_50m: list
    revetement: str = ""
    source_revetement: str = ""
    surface_osm: str = ""
    technicite: str = ""
    trafic: str = "calme"  # le plus exposé des tronçons de la côte
    couverture_osm_pct: int = 0
    profil_d: list = field(repr=False, default_factory=list)
    profil_z: list = field(repr=False, default_factory=list)
    lonlat: list = field(repr=False, default_factory=list)


def distance_depuis_centre(reseau: Reseau, voie: Voie, i: int) -> float:
    """Distance par le réseau ; à vol d'oiseau si la côte est sur une partie non reliée au centre."""
    d = reseau.distance(int(voie.troncon[i]), float(voie.offset[i]))
    return d if np.isfinite(d) else float(np.hypot(voie.x[i], voie.y[i]))


def cotes_de_voie(voie: Voie, troncons: list[Troncon], proj: Projection, reseau: Reseau,
                  args: argparse.Namespace) -> list[Cote]:
    d, z = voie.d, voie.z
    cotes = []
    for s, e in montees(d, z, args.pente_min, args.tolerance, args.plat, args.plat_long,
                        args.fusion_ecart, args.fusion_chute):
        idx = np.arange(s, e + 1) if e >= s else np.arange(s, e - 1, -1)
        dd = np.abs(d[idx] - d[s])
        zz = z[idx]
        L = dd[-1]
        pente = (zz[-1] - zz[0]) / L * 100 if L > 0 else 0
        dplus = float(np.clip(np.diff(zz), 0, None).sum())
        if L < args.longueur_min or pente < args.pente_min or dplus < args.dplus_min:
            continue
        sel = idx
        lon, lat = proj.lonlat(voie.x[sel], voie.y[sel])
        pentes = pentes_par_tranche(dd, zz)
        t_dep = troncons[voie.troncon[sel[0]]]
        natures = Counter(troncons[t].nature for t in voie.troncon[sel])
        noms = Counter(troncons[t].nom for t in voie.troncon[sel] if troncons[t].nom)
        cotes.append(Cote(
            id=0,
            distance_m=round(distance_depuis_centre(reseau, voie, sel[0])),
            longueur_m=round(float(L)),
            pente_moy_pct=round(float(pente), 1),
            pente_max_pct=max(pentes),
            dplus_m=round(dplus, 1),
            alt_depart_m=round(float(zz[0]), 1),
            alt_arrivee_m=round(float(zz[-1]), 1),
            type_voie=t_dep.type_voie,
            nature=natures.most_common(1)[0][0],
            nom=noms.most_common(1)[0][0] if noms else "",
            lat_depart=round(float(lat[0]), 6), lon_depart=round(float(lon[0]), 6),
            lat_arrivee=round(float(lat[-1]), 6), lon_arrivee=round(float(lon[-1]), 6),
            pentes_50m=pentes,
            trafic=max((troncons[t].trafic for t in set(voie.troncon[sel].tolist())), key=TRAFICS.index),
            profil_d=[round(float(v), 1) for v in dd],
            profil_z=[round(float(v), 2) for v in zz],
            lonlat=[[round(float(o), 6), round(float(a_), 6)] for o, a_ in zip(lon, lat)],
        ))
    return cotes


def dedoublonner(cotes: list[Cote], proj: Projection, tolerance_m: float = 40.0) -> list[Cote]:
    """Les routes à 2 chaussées donnent deux fois la même côte : on garde la plus marquée."""
    gardees: list[Cote] = []
    pts = []
    for c in sorted(cotes, key=lambda c: c.dplus_m, reverse=True):
        dep = np.array(proj.xy(c.lon_depart, c.lat_depart), dtype=float)
        arr = np.array(proj.xy(c.lon_arrivee, c.lat_arrivee), dtype=float)
        if any(np.hypot(*(dep - p)) < tolerance_m and np.hypot(*(arr - q)) < tolerance_m for p, q in pts):
            continue
        gardees.append(c)
        pts.append((dep, arr))
    return gardees


# --------------------------------------------------------------------------- démo hors réseau

def relief_xy(x, y):
    return (60 + 40 * np.exp(-((x - 500) ** 2 + (y - 300) ** 2) / (2 * 350 ** 2))
            + 25 * np.exp(-((x + 700) ** 2 + (y + 600) ** 2) / (2 * 200 ** 2))
            - 15 * np.exp(-(y + 100) ** 2 / (2 * 150 ** 2)))


def reseau_fictif(proj: Projection, rayon: float, maille: float = 400) -> list[dict]:
    """Quadrillage de routes et chemins, coupé à chaque intersection comme dans la BD TOPO."""
    feats = []
    lignes = np.arange(-rayon, rayon + 1, maille)
    for n, c in enumerate(lignes):
        for m in range(len(lignes) - 1):
            for horiz in (True, False):
                a, b = lignes[m], lignes[m + 1]
                xs, ys = (np.linspace(a, b, 9), np.full(9, c)) if horiz else (np.full(9, c), np.linspace(a, b, 9))
                lon, lat = proj.lonlat(xs, ys)
                feats.append({"type": "Feature", "id": f"demo.{n}.{m}.{int(horiz)}",
                              "geometry": {"type": "LineString", "coordinates": np.column_stack([lon, lat]).tolist()},
                              "properties": {"nature": "Chemin" if (n + m) % 3 == 0 else "Route à 1 chaussée",
                                             "nom_1_gauche": f"Voie {n}", "position_par_rapport_au_sol": "0",
                                             "etat_de_l_objet": "En service"}})
    return feats


# --------------------------------------------------------------------------- revêtement (OSM) et fond de carte


# --------------------------------------------------------------------------- sorties

COLONNES = [f for f in Cote.__dataclass_fields__ if f not in ("profil_d", "profil_z", "lonlat")]


def ecrire_csv(chemin: Path, cotes: list[Cote]) -> None:
    with chemin.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES)
        w.writeheader()
        for c in cotes:
            ligne = {k: getattr(c, k) for k in COLONNES}
            ligne["pentes_50m"] = ";".join(str(v) for v in c.pentes_50m)
            w.writerow(ligne)


def ecrire_geojson(chemin: Path, cotes: list[Cote], position: dict) -> None:
    feats = [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [position["lon"], position["lat"]]},
              "properties": {"role": "position_accrochee", **position}}]
    for c in cotes:
        props = {k: getattr(c, k) for k in COLONNES}
        props["profil"] = {"d_m": c.profil_d, "z_m": c.profil_z}
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": c.lonlat},
                      "properties": props})
    chemin.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False) + "\n")


def dessiner_carte(chemin: Path, troncons, cotes, proj, accroche, rayon, pente_min, titre, fond=None) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import LineCollection
    from matplotlib.colors import Normalize

    fig, ax = plt.subplots(figsize=(10, 10), dpi=120)
    if fond is not None:
        ax.imshow(fond, extent=[-rayon, rayon, -rayon, rayon], alpha=0.75, zorder=0)
        ax.text(0.99, 0.005, "Fond : Plan IGN · Revêtements : © contributeurs OpenStreetMap",
                transform=ax.transAxes, ha="right", va="bottom", fontsize=7, color="#333")
    styles = {"route": ("#9a9a9a", 0.9), "chemin": ("#b08a5a", 0.8), "sentier": ("#7a9a6a", 0.8),
              "piste cyclable": ("#6a8fb0", 0.8), "liaison": ("#9a9a9a", 0.6)}
    for tv, (couleur, lw) in styles.items():
        segs = [t.xy for t in troncons if t.type_voie == tv]
        if segs:
            ax.add_collection(LineCollection(segs, colors=couleur, linewidths=lw, label=tv))
    norm = Normalize(vmin=pente_min, vmax=max([pente_min + 5] + [c.pente_moy_pct for c in cotes]))
    cmap = plt.get_cmap("plasma_r")
    for n, c in enumerate(cotes, start=1):
        lon, lat = np.array(c.lonlat).T
        x, y = proj.xy(lon, lat)
        ax.plot(x, y, color=cmap(norm(c.pente_moy_pct)), lw=3.2, solid_capstyle="round")
        if n <= 25:
            ax.annotate(str(n), (x[len(x) // 2], y[len(y) // 2]), color="white", fontsize=7, ha="center",
                        va="center", bbox=dict(boxstyle="circle,pad=0.2", fc="#1B2A22", ec="none"))
    ax.plot(0, 0, marker="*", color="red", markersize=14, markeredgecolor="white", zorder=5)
    ax.plot(accroche["x"], accroche["y"], marker="o", color="#2F6F9F", markersize=7,
            markeredgecolor="white", zorder=5)
    fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax, shrink=0.75, label="Pente moyenne (%)")
    ax.set_xlim(-rayon, rayon)
    ax.set_ylim(-rayon, rayon)
    ax.set_aspect("equal")
    ax.legend(loc="lower left", fontsize=8)
    ax.set_xlabel("Est (m depuis le centre)")
    ax.set_ylabel("Nord (m depuis le centre)")
    ax.set_title(titre, fontsize=10)
    fig.tight_layout()
    fig.savefig(chemin)
    plt.close(fig)


# --------------------------------------------------------------------------- main

@dataclass
class Calcul:
    """Tout ce que produit le calcul autour d'un point, avant écriture des fichiers."""
    source: str
    proj: Projection
    nb_features: int
    troncons: list
    wfs: StatsWfs
    alti: StatsApi
    osm: StatsOsm
    accroche: dict = field(default_factory=dict)
    nb_voies: int = 0
    nb_points: int = 0
    taux_valide: float = 0.0
    cotes: list = field(default_factory=list)


def calculer(args: argparse.Namespace) -> Calcul:
    proj = Projection(args.lat, args.lon)
    wfs, alti, osm = StatsWfs(), StatsApi(ressource=args.ressource), StatsOsm()

    if args.demo:
        features = reseau_fictif(proj, args.rayon)
        source = "réseau et relief fictifs (--demo)"
    else:
        features = troncons_wfs(args.lat, args.lon, args.rayon, wfs, essais=args.essais)
        source = f"IGN Géoplateforme : {COUCHE} + {args.ressource}"
    wfs.axes_inverses = axes_inverses(features, args.lat, args.lon)
    troncons = lire_troncons(features, proj, wfs.axes_inverses, wfs)
    calcul = Calcul(source, proj, len(features), troncons, wfs, alti, osm)
    print(f"{len(features)} tronçons reçus, {len(troncons)} retenus")
    if not troncons:
        return calcul

    reseau = Reseau(troncons)
    accroche = reseau.accrocher(0.0, 0.0)
    lon_a, lat_a = proj.lonlat(accroche["x"], accroche["y"])
    accroche.update(lat=round(float(lat_a), 6), lon=round(float(lon_a), 6),
                    distance_m=round(accroche["distance_m"], 1))
    calcul.accroche = accroche
    print(f"Position accrochée à {accroche['distance_m']} m, sur « {accroche['nature']} »")

    voies = [echantillonner(ch, troncons, args.pas) for ch in chainer(troncons, args.angle_max)
             if troncons[ch[0][0]].type_voie != "liaison"]
    voies = [v for v in voies if v.d[-1] >= args.longueur_min]
    print(f"{len(voies)} voies d'au moins {args.longueur_min:g} m, "
          f"{sum(len(v.d) for v in voies)} points à {args.pas:g} m")

    # altitudes : uniquement les points au sol, sans doublon
    x = np.concatenate([v.x for v in voies]) if voies else np.zeros(0)
    y = np.concatenate([v.y for v in voies]) if voies else np.zeros(0)
    sol = ~np.concatenate([v.ouvrage for v in voies]) if voies else np.zeros(0, bool)
    lon, lat = proj.lonlat(x, y)
    cles = np.round(np.column_stack([lon, lat]), 6)
    uniques, inverse = np.unique(cles[sol], axis=0, return_inverse=True)
    if args.demo:
        ux, uy = proj.xy(uniques[:, 0], uniques[:, 1])
        z_u = relief_xy(ux, uy) + np.random.default_rng(0).normal(0, 0.3, len(ux))
    else:
        z_u = altitudes_ign(uniques[:, 1], uniques[:, 0], args.ressource, args.taille_lot,
                            args.pause, args.essais, alti, args.methode, args.decimales,
                            args.paralleles) if len(uniques) else np.zeros(0)
    z = np.full(len(x), np.nan)
    z[sol] = z_u[inverse.ravel()]

    cotes: list[Cote] = []
    debut = 0
    for v in voies:
        n = len(v.d)
        v.z = boucher_et_lisser(v.d, z[debut:debut + n], args.lissage, args.pas)
        debut += n
        if v.z is not None:
            cotes += cotes_de_voie(v, troncons, proj, reseau, args)
    cotes = dedoublonner(cotes, proj)
    cotes.sort(key=lambda c: c.distance_m)
    for n, c in enumerate(cotes, start=1):
        c.id = n

    voies_o = [] if args.demo or args.sans_osm else voies_osm(args.lat, args.lon, args.rayon, osm)
    qualifier_revetement(cotes, voies_o, proj)
    calcul.nb_voies, calcul.nb_points, calcul.cotes = len(voies), int(len(uniques)), cotes
    calcul.taux_valide = float(np.isfinite(z_u).mean()) if len(z_u) else 0.0
    return calcul


def analyser(args: argparse.Namespace) -> int:
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    calcul = calculer(args)
    source, proj, troncons, cotes = calcul.source, calcul.proj, calcul.troncons, calcul.cotes
    wfs, alti, osm, accroche = calcul.wfs, calcul.alti, calcul.osm, calcul.accroche
    taux_valide = calcul.taux_valide
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "ok", "source": source,
        "parametres": {k: v for k, v in vars(args).items() if k != "sortie"},
    }
    if not troncons:
        rapport.update(statut="echec_wfs", wfs=asdict(wfs),
                       resume={"Tronçons BD TOPO retenus": 0, "Requêtes WFS": wfs.requetes})
        (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
        print("ÉCHEC : aucun tronçon exploitable renvoyé par le WFS", file=sys.stderr)
        return 2

    erreurs_fond: list[str] = []
    fond = None if args.demo or args.sans_fond else fond_plan_ign(proj, args.rayon, erreurs_fond)

    ecrire_csv(sortie / "cotes.csv", cotes)
    ecrire_geojson(sortie / "cotes.geojson", cotes, accroche)
    titre = (f"Côtes ≥ {args.pente_min:g} % sur ≥ {args.longueur_min:g} m autour de "
             f"({args.lat:.4f}, {args.lon:.4f}) — {len(cotes)} côtes\nSource : {source}")
    dessiner_carte(sortie / "carte.png", troncons, cotes, proj, accroche, args.rayon, args.pente_min, titre, fond)

    echec = (1 - taux_valide) > args.max_echec
    rapport.update(
        statut="echec_api" if echec else "ok",
        resume={
            "Tronçons BD TOPO reçus / retenus": f"{calcul.nb_features} / {len(troncons)}",
            "Voies raccordées (≥ longueur mini)": calcul.nb_voies,
            "Points altimétriques demandés": calcul.nb_points,
            "Points valides": f"{100 * taux_valide:.2f} %",
            "Accrochage de la position": f"{accroche['distance_m']} m ({accroche['nature']})",
            "Côtes trouvées": len(cotes),
            "Tronçons exclus (privés / interdits aux piétons)": wfs.exclus_acces,
            "Revêtement": ", ".join(f"{k} : {v}" for k, v in Counter(c.source_revetement for c in cotes).items()),
            "OpenStreetMap": f"{osm.statut} ({osm.nb_voies} voies)",
            "Fond Plan IGN": "ok" if fond is not None else ("—" if args.demo or args.sans_fond else "échec"),
            "Requêtes WFS / altimétrie": f"{wfs.requetes} / {alti.requetes}",
        },
        accroche=accroche,
        nb_cotes=len(cotes),
        top=[{k: getattr(c, k) for k in ("id", "distance_m", "longueur_m", "pente_moy_pct", "pente_max_pct",
                                         "dplus_m", "type_voie", "revetement", "technicite", "nom")}
             for c in cotes[:10]],
        osm=None if args.demo else asdict(osm),
        fond_erreurs=erreurs_fond,
        wfs=None if args.demo else asdict(wfs),
        api=None if args.demo else asdict(alti),
    )
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")

    print(f"{len(cotes)} côtes, {100 * taux_valide:.1f} % de points valides")
    for c in cotes[:8]:
        print(f"  n°{c.id} à {c.distance_m} m : {c.longueur_m} m à {c.pente_moy_pct} % "
              f"(+{c.dplus_m} m, max {c.pente_max_pct} %) — {c.type_voie}, {c.revetement} {c.nom}")
    if echec:
        print(f"ÉCHEC : {100 * (1 - taux_valide):.1f} % de points sans altitude", file=sys.stderr)
        return 2
    return 0


def parser_arguments(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lat", type=float, default=RENNES_LAT, help="position de l'utilisateur")
    p.add_argument("--lon", type=float, default=RENNES_LON)
    p.add_argument("--rayon", type=float, default=2000, help="demi-côté du carré analysé, en m (défaut 2000)")
    p.add_argument("--pas", type=float, default=10, help="espacement des points le long des voies, en m (défaut 10)")
    p.add_argument("--lissage", type=float, default=20, help="sigma du lissage du profil, en m (défaut 20)")
    p.add_argument("--pente-min", type=float, default=5, help="pente moyenne mini d'une côte, en %% (défaut 5)")
    p.add_argument("--longueur-min", type=float, default=150, help="longueur mini d'une côte, en m (défaut 150)")
    p.add_argument("--dplus-min", type=float, default=8, help="D+ mini d'une côte, en m (défaut 8)")
    p.add_argument("--tolerance", type=float, default=3,
                   help="contre-pente tolérée dans une côte, en m de dénivelé (défaut 3)")
    p.add_argument("--plat", type=float, default=1.5, help="pente sous laquelle une portion est un replat (défaut 1.5)")
    p.add_argument("--plat-long", type=float, default=150,
                   help="longueur de replat qui coupe une côte en deux, en m (défaut 150)")
    p.add_argument("--fusion-ecart", type=float, default=200,
                   help="écart maxi entre deux montées réunies en une, en m (défaut 200)")
    p.add_argument("--fusion-chute", type=float, default=10,
                   help="chute maxi entre deux montées réunies en une, en m (défaut 10)")
    p.add_argument("--angle-max", type=float, default=45,
                   help="virage maxi pour prolonger une voie à une intersection, en degrés (défaut 45)")
    p.add_argument("--ressource", default=RESSOURCE_DEFAUT)
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT,
                   help="points par requête altimétrique (défaut %(default)s)")
    p.add_argument("--methode", choices=("GET", "POST", "POST_JSON"), default=METHODE_DEFAUT,
                   help="requêtes altimétriques (défaut %(default)s, repli GET automatique)")
    p.add_argument("--decimales", type=int, default=6, help="décimales des coordonnées envoyées (défaut 6)")
    p.add_argument("--paralleles", type=int, default=1, help="requêtes altimétriques simultanées (défaut 1)")
    p.add_argument("--pause", type=float, default=0.25)
    p.add_argument("--essais", type=int, default=4)
    p.add_argument("--max-echec", type=float, default=0.05)
    p.add_argument("--sortie", default="resultats/rennes_cotes")
    p.add_argument("--sans-osm", action="store_true", help="ne pas interroger OpenStreetMap pour le revêtement")
    p.add_argument("--sans-fond", action="store_true", help="carte sans fond Plan IGN")
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans appel réseau")
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(analyser(parser_arguments()))
