#!/usr/bin/env python3
"""Segmentation d'un parcours GPX en montées, descentes et plats (écran « Parcours segmenté »).

Étapes :
  1. lecture du GPX (trace ou route), un point tous les --pas mètres le long du tracé ;
  2. altitudes IGN (RGE ALTI) ; si le service échoue, repli sur les altitudes du GPX ;
  3. lissage du profil ;
  4. pente sur une fenêtre glissante (--fenetre m), classement montée / descente / plat
     selon --seuil, puis fusion des morceaux plus courts que --longueur-min ;
  5. pour chaque segment : distance, D+, D−, pente moyenne et max (sur 50 m), niveau de
     difficulté et une description courte (« Régulière, raide en fin »).

Sorties (dans --sortie) : segments.csv, parcours.json (résumé, segments, profil tous les 50 m,
lu par plan_nutrition.py), profil.png, rapport.json.

Exemple :
  python scripts/segmenter_gpx.py mon_parcours.gpx --sortie resultats/mon_parcours
  python scripts/segmenter_gpx.py mon_parcours.gpx --altitudes gpx   # sans appel à l'IGN
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trailcotes.geo import Projection, echantillonner_ligne, longueurs_cumulees  # noqa: E402
from trailcotes.gpx import lire_gpx  # noqa: E402
from trailcotes.ign import LOT_DEFAUT, METHODE_DEFAUT, RESSOURCE_DEFAUT, StatsApi, altitudes_ign  # noqa: E402
from trailcotes.profil import boucher_et_lisser, pentes_par_tranche  # noqa: E402

TYPES = {1: "montée", -1: "descente", 0: "plat"}
NIVEAUX = ["facile", "modérée", "difficile", "très difficile"]


# --------------------------------------------------------------------------- segmentation

def pente_centree(d: np.ndarray, z: np.ndarray, fenetre: float) -> np.ndarray:
    """Pente (%) sur une fenêtre de `fenetre` m centrée sur chaque point (raccourcie aux bouts)."""
    a = np.maximum(d - fenetre / 2, d[0])
    b = np.minimum(d + fenetre / 2, d[-1])
    with np.errstate(invalid="ignore", divide="ignore"):
        p = (np.interp(b, d, z) - np.interp(a, d, z)) / (b - a) * 100
    return np.nan_to_num(p)


def classer(pente: float, seuil: float) -> int:
    return 1 if pente > seuil else (-1 if pente < -seuil else 0)


def segmenter(d: np.ndarray, z: np.ndarray, seuil: float = 3.0, fenetre: float = 200.0,
              longueur_min: float = 300.0) -> list[tuple[int, int, int]]:
    """Segments (indice début, indice fin, type) contigus, le dernier point de l'un étant le premier du suivant."""
    classes = [classer(p, seuil) for p in pente_centree(d, z, fenetre)]
    segs, debut = [], 0
    for i in range(1, len(d)):
        if classes[i] != classes[debut] or i == len(d) - 1:
            segs.append([debut, i, classes[debut]])
            debut = i

    def longueur(s):
        return d[s[1]] - d[s[0]]

    def reclasser(a, b):
        return classer((z[b] - z[a]) / max(d[b] - d[a], 1e-9) * 100, seuil)

    def fusionner_voisins(segs):
        out = [segs[0]]
        for s in segs[1:]:
            if s[2] == out[-1][2]:
                out[-1] = [out[-1][0], s[1], s[2]]
            else:
                out.append(s)
        return out

    segs = fusionner_voisins(segs)
    while len(segs) > 1:
        courts = [i for i, s in enumerate(segs) if longueur(s) < longueur_min]
        if not courts:
            break
        i = min(courts, key=lambda k: longueur(segs[k]))
        voisins = [j for j in (i - 1, i + 1) if 0 <= j < len(segs)]
        j = max(voisins, key=lambda k: longueur(segs[k]))
        a, b = min(segs[i][0], segs[j][0]), max(segs[i][1], segs[j][1])
        segs[min(i, j)] = [a, b, reclasser(a, b)]
        del segs[max(i, j)]
        segs = fusionner_voisins(segs)
    return [tuple(s) for s in segs]


@dataclass
class Segment:
    n: int
    type: str
    km_debut: float
    km_fin: float
    distance_km: float
    dplus_m: float
    dmoins_m: float
    pente_moy_pct: float
    pente_max_pct: float  # pente la plus forte sur 50 m, dans le sens du segment (descente : en valeur absolue)
    alt_debut_m: float
    alt_fin_m: float
    difficulte: str
    description: str


def qualifier(type_: int, d: np.ndarray, z: np.ndarray) -> tuple[str, str, float]:
    """(difficulté, description, pente max) d'un segment."""
    L = d[-1] - d[0]
    pente = (z[-1] - z[0]) / L * 100 if L > 0 else 0.0
    tranches = np.array(pentes_par_tranche(d, z)) if L > 0 else np.zeros(1)
    if type_ == 0:
        return "facile", "Roulant, relancer" if abs(pente) < 1.5 else "Faux plat", float(np.abs(tranches).max())
    sens = 1 if type_ > 0 else -1
    p = abs(pente)
    pmax = float((sens * tranches).max())
    bornes = (5, 8, 12) if sens > 0 else (6, 12, 20)
    niveau = sum(p >= b for b in bornes)
    if sens > 0 and (z[-1] - z[0]) > 600 and niveau < 3:
        niveau += 1  # une longue montée use, même peu raide
    if pmax > (20 if sens > 0 else 30) and niveau < 3:
        niveau += 1  # passage très raide
    mots = ["Régulière" if np.std(tranches) < 2.5 else "Irrégulière"]
    if len(tranches) >= 3:
        tiers = [abs(np.mean(t)) for t in np.array_split(tranches, 3)]
        k = int(np.argmax(tiers))
        if tiers[k] > p + 2:
            mots.append(("raide" if sens > 0 else "pentue") + [" en début", " au milieu", " en fin"][k])
    if sens > 0 and p < 6:
        mots.append("roulante")
    if sens < 0 and pmax > 20:
        mots.append("technique")
    return NIVEAUX[niveau], ", ".join([mots[0]] + [m.lower() for m in mots[1:]]), pmax


def decrire(segs, d, z) -> list[Segment]:
    sortie = []
    for n, (a, b, t) in enumerate(segs, start=1):
        dd, zz = d[a:b + 1], z[a:b + 1]
        diff = np.diff(zz)
        niveau, texte, pmax = qualifier(t, dd, zz)
        L = dd[-1] - dd[0]
        sortie.append(Segment(
            n=n, type=TYPES[t], km_debut=round(dd[0] / 1000, 2), km_fin=round(dd[-1] / 1000, 2),
            distance_km=round(L / 1000, 2), dplus_m=round(float(diff[diff > 0].sum())),
            dmoins_m=round(float(-diff[diff < 0].sum())),
            pente_moy_pct=round(float((zz[-1] - zz[0]) / L * 100), 1) if L > 0 else 0.0,
            pente_max_pct=round(pmax, 1), alt_debut_m=round(float(zz[0])), alt_fin_m=round(float(zz[-1])),
            difficulte=niveau, description=texte))
    return sortie


# --------------------------------------------------------------------------- sorties

COULEURS = {"montée": "#D9541E", "descente": "#2F6F9F", "plat": "#7A7F78"}


def dessiner_profil(chemin: Path, d, z_brut, z, segs, segments, titre) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(12, 4.5), dpi=120)
    ax.fill_between(d / 1000, z, z.min() - 20, color="#EFEADF")
    ax.plot(d / 1000, z_brut, color="#c9c2b2", lw=0.6)
    for (a, b, _), s in zip(segs, segments):
        ax.plot(d[a:b + 1] / 1000, z[a:b + 1], color=COULEURS[s.type], lw=2.2)
    for t, c in COULEURS.items():
        ax.plot([], [], color=c, lw=3, label=t.capitalize())
    ax.set_xlabel("Distance (km)")
    ax.set_ylabel("Altitude (m)")
    ax.set_ylim(z.min() - 20, z.max() + 40)
    ax.legend(loc="upper right", fontsize=8)
    ax.set_title(titre, fontsize=10)
    ax.grid(alpha=0.25)
    fig.tight_layout()
    fig.savefig(chemin)
    plt.close(fig)


def analyser(args: argparse.Namespace) -> int:
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    nom, lat, lon, ele = lire_gpx(args.gpx)
    proj = Projection(float(np.mean(lat)), float(np.mean(lon)))
    xy = np.column_stack(proj.xy(lon, lat))
    garder = np.r_[True, np.hypot(*np.diff(xy, axis=0).T) > 0.01]  # points répétés
    xy, ele = xy[garder], ele[garder]
    d, x, y = echantillonner_ligne(xy, args.pas)
    plon, plat_ = proj.lonlat(x, y)
    ele_gpx = np.interp(d, longueurs_cumulees(xy), ele) if np.isfinite(ele).sum() >= 2 else np.full(len(d), np.nan)
    print(f"{nom} : {d[-1] / 1000:.1f} km, {len(d)} points à {args.pas:g} m")

    stats = StatsApi(ressource=args.ressource)
    source = "IGN RGE ALTI"
    if args.altitudes == "ign":
        z_brut = altitudes_ign(plat_, plon, args.ressource, args.taille_lot, args.pause, args.essais, stats,
                               args.methode)
        if np.isnan(z_brut).mean() > 0.05:
            print("  ! trop de points sans altitude IGN : repli sur les altitudes du GPX", file=sys.stderr)
            z_brut, source = ele_gpx, "GPX (repli : service IGN indisponible)"
    else:
        z_brut, source = ele_gpx, "GPX"
    z = boucher_et_lisser(d, z_brut, args.lissage, args.pas)
    if z is None:
        print("ÉCHEC : aucune altitude (ni IGN ni GPX)", file=sys.stderr)
        return 2

    segs = segmenter(d, z, args.seuil, args.fenetre, args.longueur_min)
    segments = decrire(segs, d, z)
    diff = np.diff(z)
    resume = {
        "nom": nom, "distance_km": round(d[-1] / 1000, 2),
        "dplus_m": round(float(diff[diff > 0].sum())), "dmoins_m": round(float(-diff[diff < 0].sum())),
        "alt_max_m": round(float(z.max())), "alt_min_m": round(float(z.min())),
        "source_altitudes": source,
        "nb_segments": len(segments),
    }
    km50 = np.arange(0, d[-1], 50.0)
    parcours = resume | {
        "segments": [asdict(s) for s in segments],
        "profil": {"d_km": [round(v / 1000, 3) for v in km50],
                   "z_m": [round(float(v), 1) for v in np.interp(km50, d, z)]},
    }
    (sortie / "parcours.json").write_text(json.dumps(parcours, ensure_ascii=False) + "\n")
    with (sortie / "segments.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(Segment.__dataclass_fields__))
        w.writeheader()
        w.writerows(asdict(s) for s in segments)
    titre = (f"{nom} — {resume['distance_km']} km, D+ {resume['dplus_m']} m, D− {resume['dmoins_m']} m, "
             f"{len(segments)} segments\nAltitudes : {source}")
    dessiner_profil(sortie / "profil.png", d, np.where(np.isfinite(z_brut), z_brut, z), z, segs, segments, titre)

    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "repli_gpx" if args.altitudes == "ign" and not source.startswith("IGN") else "ok",
        "parametres": {k: v for k, v in vars(args).items() if k != "sortie"},
        "resume": {"Parcours": f"{resume['distance_km']} km, D+ {resume['dplus_m']} m, D− {resume['dmoins_m']} m",
                   "Altitudes": source, "Segments": len(segments),
                   "Montées / descentes / plats": "/".join(str(sum(s.type == t for s in segments))
                                                           for t in ("montée", "descente", "plat"))},
        "segments": [asdict(s) for s in segments],
        "api": None if args.altitudes == "gpx" else asdict(stats),
    }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    for s in segments[:12]:
        print(f"  {s.n:>2} {s.type:<8} km {s.km_debut:>6} – {s.km_fin:<6} {s.dplus_m:>5} m+ {s.pente_moy_pct:>5} % "
              f"(max {s.pente_max_pct} %) {s.difficulte} — {s.description}")
    return 0


def parser_arguments(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("gpx", help="fichier GPX")
    p.add_argument("--altitudes", choices=("ign", "gpx"), default="ign")
    p.add_argument("--pas", type=float, default=10)
    p.add_argument("--lissage", type=float, default=30, help="sigma du lissage, en m (défaut 30)")
    p.add_argument("--seuil", type=float, default=3, help="pente au-delà de laquelle on monte ou descend, en %% (défaut 3)")
    p.add_argument("--fenetre", type=float, default=200, help="fenêtre de calcul de la pente, en m (défaut 200)")
    p.add_argument("--longueur-min", type=float, default=300, help="longueur mini d'un segment, en m (défaut 300)")
    p.add_argument("--ressource", default=RESSOURCE_DEFAUT)
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT,
                   help="points par requête altimétrique (défaut %(default)s)")
    p.add_argument("--methode", choices=("GET", "POST", "POST_JSON"), default=METHODE_DEFAUT)
    p.add_argument("--pause", type=float, default=0.25)
    p.add_argument("--essais", type=int, default=4)
    p.add_argument("--sortie", default="resultats/parcours")
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(analyser(parser_arguments()))
