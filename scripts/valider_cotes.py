#!/usr/bin/env python3
"""Validation sur des montées de référence dont les chiffres sont publics.

Pour chaque montée : tronçons BD TOPO (routes) autour du départ et de l'arrivée, plus court
chemin par la route, profil IGN tous les 10 m lissé, puis comparaison avec la référence
(longueur, dénivelé, pente moyenne, altitude au sommet). Le script détecte aussi les côtes sur ce
profil avec le même algorithme que cotes_bdtopo.py, pour vérifier que la montée ressort entière.

Il mesure enfin le débit de l'API altimétrique selon la méthode et la taille des lots, pour
dimensionner le précalcul à l'échelle d'un département.

Sorties (dans --sortie) : validation.csv, <montée>.gpx (trace avec altitudes IGN),
<montée>.png (profil), rapport.json.

Les écarts tolérés (5 % sur la longueur et le dénivelé, 0,5 point de pente) couvrent
l'imprécision des points de départ et d'arrivée, placés à la main.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys

from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trailcotes.bdtopo import Reseau, StatsWfs, axes_inverses, lire_troncons, troncons_wfs  # noqa: E402
from trailcotes.geo import Projection, echantillonner_ligne  # noqa: E402
from trailcotes.gpx import ecrire_gpx  # noqa: E402
from trailcotes.ign import (  # noqa: E402
    LOT_DEFAUT, METHODE_DEFAUT, RAYON_TERRE, RESSOURCE_DEFAUT, StatsApi, altitudes_ign, mesurer_debit,
)
from trailcotes.profil import boucher_et_lisser, montees  # noqa: E402

# Chiffres couramment publiés pour ces ascensions (longueur, dénivelé, pente moyenne).
REFERENCES = [
    {"cle": "ventoux_bedoin", "nom": "Mont Ventoux par Bédoin",
     "depart": (44.1243, 5.1793), "arrivee": (44.1739, 5.2786),
     "longueur_m": 21500, "denivele_m": 1610, "pente_moy_pct": 7.5, "alt_arrivee_m": 1909},
    {"cle": "alpe_d_huez", "nom": "Alpe d'Huez par Le Bourg-d'Oisans",
     "depart": (45.0607, 6.0384), "arrivee": (45.0904, 6.0697),
     "longueur_m": 13800, "denivele_m": 1120, "pente_moy_pct": 8.1, "alt_arrivee_m": 1860},
]
TOL_RELATIVE = 0.05
TOL_PENTE = 0.5


def diagnostic(reseau: Reseau, depart, arrivee) -> dict:
    """Accrochage du départ et de l'arrivée, et appartenance à la même partie connexe du réseau."""
    from scipy.sparse.csgraph import connected_components

    _, etiquettes = connected_components(reseau.graphe, directed=False)
    sortie = {}
    for nom, (x, y) in (("depart", depart), ("arrivee", arrivee)):
        k, _, dist = reseau.projeter(float(x), float(y))
        comp = etiquettes[reseau.a[k]]
        sortie[nom] = {"accrochage_m": round(dist, 1), "nature": reseau.troncons[k].nature,
                       "composante": int(comp), "taille_composante": int((etiquettes == comp).sum())}
    sortie["meme_composante"] = sortie["depart"]["composante"] == sortie["arrivee"]["composante"]
    return sortie


def valider(ref: dict, args, sortie: Path) -> dict:
    (lat0, lon0), (lat1, lon1) = ref["depart"], ref["arrivee"]
    latc, lonc = (lat0 + lat1) / 2, (lon0 + lon1) / 2
    proj = Projection(latc, lonc)
    x0, y0 = proj.xy(lon0, lat0)
    x1, y1 = proj.xy(lon1, lat1)
    rayon = max(abs(x1 - x0), abs(y1 - y0)) / 2 + args.marge
    print(f"\n== {ref['nom']} : carré de {2 * rayon / 1000:.1f} km")

    wfs, alti = StatsWfs(), StatsApi()
    features = troncons_wfs(latc, lonc, rayon, wfs)
    wfs.axes_inverses = axes_inverses(features, latc, lonc)
    tous = lire_troncons(features, proj, wfs.axes_inverses, wfs)
    res = {"cle": ref["cle"], "nom": ref["nom"], "troncons": len(tous), "wfs_codes": wfs.codes_http,
           "statut": "échec"}
    xy = None
    # par la route d'abord ; à défaut (réseau coupé dans l'emprise), en acceptant aussi les chemins
    # routes et ronds-points, sans escaliers ni sentiers : ce sont des montées routières
    for reseau_nom, garder in (("routes", lambda t: t.type_voie == "route" or t.nature == "Rond-point"),
                               ("toutes voies", lambda t: True)):
        troncons = [t for t in tous if garder(t)]
        if not troncons:
            continue
        # comme un calcul d'itinéraire : les dessertes (importance 5 et 6) comptent triple, pour
        # suivre la route de la montée plutôt qu'un raccourci par un village
        reseau = Reseau(troncons, penalite=lambda t: 3.0 if t.importance >= 5 else 1.0)
        xy = reseau.chemin((float(x0), float(y0)), (float(x1), float(y1)))
        res.setdefault("diagnostic", {})[reseau_nom] = diagnostic(reseau, (x0, y0), (x1, y1))
        if xy is not None:
            res["reseau"] = reseau_nom
            break
    if xy is None:
        res["statut"] = "pas de chemin"
        return res

    d, x, y = echantillonner_ligne(xy, args.pas)
    lon, lat = proj.lonlat(x, y)
    z_brut = altitudes_ign(lat, lon, args.ressource, args.taille_lot, args.pause, 4, alti, args.methode)
    z = boucher_et_lisser(d, z_brut, args.lissage, args.pas)
    if z is None:
        res["statut"] = "pas d'altitude"
        return res

    longueur = float(d[-1])
    denivele = float(z[-1] - z[0])
    dplus = float(np.clip(np.diff(z), 0, None).sum())
    pente = 100 * denivele / longueur
    # même détection que cotes_bdtopo.py : la plus grande montée trouvée sur le profil
    trouvees = [(abs(d[e] - d[s]), z[e] - z[s]) for s, e in montees(d, z, 5.0) if e > s]
    plus_grande = max(trouvees, key=lambda m: m[1], default=(0.0, 0.0))

    ecarts = {
        "longueur_pct": round(100 * (longueur / ref["longueur_m"] - 1), 1),
        "denivele_pct": round(100 * (denivele / ref["denivele_m"] - 1), 1),
        "pente_pts": round(pente - ref["pente_moy_pct"], 2),
        "alt_arrivee_m": round(float(z_brut[np.isfinite(z_brut)][-1]) - ref["alt_arrivee_m"], 1),
    }
    if abs(ecarts["alt_arrivee_m"]) > 150:
        res["alerte"] = "arrivée non atteinte : réseau coupé dans l'emprise ou point d'arrivée mal placé"
    conforme = (abs(ecarts["longueur_pct"]) <= 100 * TOL_RELATIVE and abs(ecarts["denivele_pct"]) <= 100 * TOL_RELATIVE
                and abs(ecarts["pente_pts"]) <= TOL_PENTE)
    res.update(
        statut="conforme" if conforme else "à examiner",
        longueur_m=round(longueur), denivele_m=round(denivele), dplus_m=round(dplus), pente_moy_pct=round(pente, 2),
        alt_depart_m=round(float(z[0]), 1), alt_arrivee_m=round(float(z[-1]), 1),
        ref_longueur_m=ref["longueur_m"], ref_denivele_m=ref["denivele_m"], ref_pente_moy_pct=ref["pente_moy_pct"],
        ref_alt_arrivee_m=ref["alt_arrivee_m"], ecarts=ecarts,
        plus_grande_montee={"longueur_m": round(plus_grande[0]), "denivele_m": round(plus_grande[1]),
                            "part_du_denivele_pct": round(100 * plus_grande[1] / denivele) if denivele > 0 else 0,
                            "nb_montees": len(trouvees)},
        points=int(len(d)), alti_codes=alti.codes_http, alti_duree_s=alti.duree_s,
    )
    ecrire_gpx(sortie / f"{ref['cle']}.gpx", ref["nom"], lat, lon, z_brut)
    dessiner_profil(sortie / f"{ref['cle']}.png", d, z_brut, z, ref, res)
    print(f"  {res['statut']} : {longueur / 1000:.2f} km, {denivele:.0f} m, {pente:.2f} % — écarts {ecarts}")
    return res


def dessiner_profil(chemin: Path, d, z_brut, z, ref, res) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(10, 4.5), dpi=120)
    ax.plot(d / 1000, z_brut, color="#c9c2b2", lw=0.8, label="IGN brut (tous les 10 m)")
    ax.plot(d / 1000, z, color="#D9541E", lw=2, label="lissé")
    ax.axhline(ref["alt_arrivee_m"], color="#1B2A22", lw=0.8, ls="--", label="altitude publiée au sommet")
    ax.set_xlabel("Distance (km)")
    ax.set_ylabel("Altitude (m)")
    ax.set_title(f"{ref['nom']} — calculé {res['longueur_m'] / 1000:.1f} km, {res['denivele_m']} m, "
                 f"{res['pente_moy_pct']} % (référence {ref['longueur_m'] / 1000:.1f} km, "
                 f"{ref['denivele_m']} m, {ref['pente_moy_pct']} %)", fontsize=9)
    ax.legend(fontsize=8)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(chemin)
    plt.close(fig)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--pas", type=float, default=10)
    p.add_argument("--lissage", type=float, default=20)
    p.add_argument("--marge", type=float, default=3000,
                   help="marge autour du départ et de l'arrivée, en m (la route peut faire un détour)")
    p.add_argument("--ressource", default=RESSOURCE_DEFAUT)
    p.add_argument("--taille-lot", type=int, default=LOT_DEFAUT,
                   help="points par requête altimétrique (défaut %(default)s)")
    p.add_argument("--methode", choices=("GET", "POST", "POST_JSON"), default=METHODE_DEFAUT)
    p.add_argument("--pause", type=float, default=0.25)
    p.add_argument("--sans-debit", action="store_true", help="ne pas mesurer le débit de l'API")
    p.add_argument("--sortie", default="resultats/validation")
    args = p.parse_args(argv)
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    resultats = [valider(ref, args, sortie) for ref in REFERENCES]

    debit = []
    if not args.sans_debit:
        # points répartis sur la France métropolitaine, pour ne pas mesurer un cache local
        rng = np.random.default_rng(0)
        lat = rng.uniform(43.5, 49.5, 5000)
        lon = rng.uniform(-1.0, 6.5, 5000)
        debit = mesurer_debit(lat, lon, args.ressource)
        for m in debit:
            print(f"  débit {m['methode']} lot {m['taille_lot']} ({m['decimales']} déc., ×{m['paralleles']}) : "
                  f"{m['codes_http']} {m['points_par_s']} pts/s {m['erreur']}")

    colonnes = ["cle", "nom", "statut", "longueur_m", "ref_longueur_m", "denivele_m", "ref_denivele_m",
                "pente_moy_pct", "ref_pente_moy_pct", "alt_arrivee_m", "ref_alt_arrivee_m"]
    with (sortie / "validation.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=colonnes, extrasaction="ignore")
        w.writeheader()
        w.writerows(resultats)
    statut = "ok" if all(r["statut"] in ("conforme", "à examiner") for r in resultats) else "echec_service"
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": statut,
        "resume": {r["nom"]: (f"{r['statut']} — {r.get('longueur_m', 0) / 1000:.2f} km, {r.get('denivele_m')} m, "
                              f"{r.get('pente_moy_pct')} % ; écarts {r.get('ecarts')}") for r in resultats}
                  | {f"Débit {m['methode']} lot {m['taille_lot']} ({m['decimales']} déc., ×{m['paralleles']})":
                     f"{m['points_par_s']} pts/s {m['codes_http']}"
                     for m in debit},
        "montees": resultats,
        "debit_api": debit,
        "rayon_terre_m": RAYON_TERRE,
    }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2, default=str) + "\n")
    return 0 if statut == "ok" else 2


if __name__ == "__main__":
    sys.exit(main())
