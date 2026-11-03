#!/usr/bin/env python3
"""Réseau des voies pour les boucles de l'application : briques communes (voir reseau_france.py).

L'application compose les boucles sur le téléphone : elle a besoin du graphe des voies praticables à
pied, avec pour chaque tronçon sa longueur, son D+ dans les deux sens, son type (route, chemin,
sentier…) et son exposition au trafic.

- Altitudes : RGE ALTI, un point tous les `pas` mètres le long de chaque tronçon. Sur les ponts et
  dans les tunnels, le terrain n'est pas la voie : le profil y est remplacé par une droite entre les
  deux extrémités.
- Géométrie simplifiée (Douglas-Peucker) et coordonnées entières (1e-5°) pour un fichier léger.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from trailcotes.bdtopo import TRAFICS  # noqa: E402
from trailcotes.geo import Projection, longueurs_cumulees  # noqa: E402

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


def aretes_brutes(troncons, proj: Projection, z_points, pas: float, tolerance: float) -> tuple[list, dict]:
    """Arêtes avec leurs extrémités en coordonnées entières (lon, lat × 1e5) : deux tuiles calculées
    séparément se raccordent sur ces coordonnées. `z_points(x, y)` → altitudes."""
    echantillons = []
    for t in troncons:
        c = longueurs_cumulees(t.xy)
        d = np.unique(np.append(np.arange(0.0, c[-1], pas), c[-1]))
        echantillons.append((d, np.interp(d, c, t.xy[:, 0]), np.interp(d, c, t.xy[:, 1])))
    xs = np.concatenate([e[1] for e in echantillons]) if echantillons else np.zeros(0)
    ys = np.concatenate([e[2] for e in echantillons]) if echantillons else np.zeros(0)
    z_tous = z_points(xs, ys) if len(xs) else np.zeros(0)

    def entier(xy):
        lon, lat = proj.lonlat(np.atleast_1d(xy[..., 0]), np.atleast_1d(xy[..., 1]))
        return [v for o, a_ in zip(lon, lat) for v in (int(round(float(o) * 1e5)), int(round(float(a_) * 1e5)))]

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
        a_, b_ = entier(t.xy[0]), entier(t.xy[-1])
        if a_ == b_ and t.longueur < 5:
            continue
        inter = entier(t.xy[douglas_peucker(t.xy, tolerance)[1:-1]]) if len(t.xy) > 2 else []
        aretes.append([*a_, *b_, int(round(t.longueur)), round(plus, 1), round(moins, 1), TYPES.index(t.type_voie),
                       TRAFICS.index(t.trafic), t.nom or "", inter])
    stats = {"points_altitude": int(len(xs)), "aretes_sans_altitude": sans_altitude,
             "points_valides_pct": round(100 * float(np.isfinite(z_tous).mean()), 2) if len(z_tous) else 100.0}
    return aretes, stats


def indexer(aretes: list) -> dict:
    """Arêtes à extrémités en coordonnées → format de l'application (nœuds numérotés, noms en table)."""
    noeuds: dict[tuple[int, int], int] = {}
    noms: dict[str, int] = {}

    def noeud(lo, la) -> int:
        return noeuds.setdefault((lo, la), len(noeuds))

    sortie = []
    for lo_a, la_a, lo_b, la_b, longueur, plus, moins, t, s, nom, inter in aretes:
        sortie.append([noeud(lo_a, la_a), noeud(lo_b, la_b), longueur, plus, moins, t, s,
                       noms.setdefault(nom, len(noms)) if nom else -1, inter])
    return {"types": list(TYPES), "trafics": list(TRAFICS), "noeuds": [list(k) for k in noeuds],
            "aretes": sortie, "noms": list(noms)}
