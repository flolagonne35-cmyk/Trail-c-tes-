"""Profils en long : lissage, sommets et creux, découpage des montées, pentes par tranche."""

from __future__ import annotations

import numpy as np
from scipy import ndimage


def boucher_et_lisser(d: np.ndarray, z: np.ndarray, sigma_m: float, pas: float) -> np.ndarray | None:
    ok = np.isfinite(z)
    if ok.sum() < 2:
        return None
    z = np.interp(d, d[ok], z[ok])
    return ndimage.gaussian_filter1d(z, sigma_m / pas, mode="nearest") if sigma_m > 0 else z


def extrema(z: np.ndarray, tolerance: float) -> list[int]:
    """Sommets et creux successifs, en ignorant les variations inférieures à `tolerance` m."""
    imin = imax = 0
    tendance, cand, points = 0, 0, []
    for i in range(1, len(z)):
        if tendance == 0:
            imin = i if z[i] < z[imin] else imin
            imax = i if z[i] > z[imax] else imax
            if z[imax] - z[imin] >= tolerance:
                if imin < imax:
                    points, tendance, cand = [imin], 1, imax
                else:
                    points, tendance, cand = [imax], -1, imin
        elif tendance == 1:
            if z[i] > z[cand]:
                cand = i
            elif z[cand] - z[i] >= tolerance:
                points.append(cand)
                tendance, cand = -1, i
        else:
            if z[i] < z[cand]:
                cand = i
            elif z[i] - z[cand] >= tolerance:
                points.append(cand)
                tendance, cand = 1, i
    if tendance:
        points.append(cand)
    return points


def pente_avant(d: np.ndarray, z: np.ndarray, fenetre: float) -> np.ndarray:
    """Pente (%) sur les `fenetre` mètres qui suivent chaque point (NaN en bout de profil)."""
    j = np.minimum(np.searchsorted(d, d + fenetre - 1e-6), len(d) - 1)
    with np.errstate(invalid="ignore", divide="ignore"):
        p = (z[j] - z) / (d[j] - d) * 100
    p[j == np.arange(len(d))] = np.nan
    return p


def rogner(d, z, i, k, seuil, fenetre) -> tuple[int, int]:
    """Retire les bouts plus doux que `seuil` au début et à la fin de [i, k]."""
    av = pente_avant(d, z, fenetre)
    while i < k and not (av[i] >= seuil):
        i += 1
    dr, zr = d[-1] - d[::-1], z[::-1]
    ar = -pente_avant(dr, zr, fenetre)[::-1]  # pente sur les `fenetre` mètres qui précèdent
    while k > i and not (ar[k] >= seuil):
        k -= 1
    return i, k


def decouper_montee(d, z, seuil_bord, plat, plat_long, fenetre, fenetre_bord=20.0) -> list[tuple[int, int]]:
    """Une montée (d croissant, z globalement croissant) → morceaux sans long replat.

    Les replats se repèrent sur `fenetre` m, les bouts se rognent sur `fenetre_bord` m (plus fin)."""
    i, k = rogner(d, z, 0, len(d) - 1, seuil_bord, fenetre_bord)
    if k <= i:
        return []
    av = pente_avant(d, z, fenetre)
    morceaux, debut, run = [], i, None
    for j in range(i, k + 1):
        if av[j] < plat:
            run = j if run is None else run
        else:
            if run is not None and d[j] - d[run] >= plat_long:
                morceaux.append((debut, run))
                debut = j
            run = None
    morceaux.append((debut, k))
    return [r for r in (rogner(d, z, a, b, seuil_bord, fenetre_bord) for a, b in morceaux) if r[1] > r[0]]


def pentes_par_tranche(d: np.ndarray, z: np.ndarray, tranche: float = 50.0) -> list[float]:
    bornes = np.arange(d[0], d[-1], tranche)
    if len(bornes) > 1 and d[-1] - bornes[-1] < tranche * 0.4:
        bornes = bornes[:-1]  # dernière tranche trop courte : rattachée à la précédente
    bornes = np.append(bornes, d[-1])
    zb = np.interp(bornes, d, z)
    return [round(float(v), 1) for v in np.diff(zb) / np.diff(bornes) * 100]


def montees(d: np.ndarray, z: np.ndarray, pente_min: float, tolerance: float = 3.0, plat: float = 1.5,
            plat_long: float = 150.0, fusion_ecart: float = 200.0, fusion_chute: float = 10.0,
            fenetre: float = 50.0) -> list[tuple[int, int]]:
    """Montées d'un profil, dans les deux sens : liste de (indice du pied, indice du sommet).

    1. sommets et creux successifs (contre-pentes < `tolerance` m ignorées) ;
    2. chaque jambe montante est rognée de ses bouts plats et coupée aux replats ;
    3. deux montées qui se suivent dans le même sens sont réunies si l'écart fait moins de
       `fusion_ecart` m, la chute moins de `fusion_chute` m, et si l'ensemble garde `pente_min` :
       un petit pont ou une épingle ne coupe pas l'Alpe d'Huez en cinq, mais deux rampes séparées
       par un long plat restent distinctes.
    """
    sommets = extrema(z, tolerance)
    par_sens: dict[int, list[tuple[int, int]]] = {1: [], -1: []}
    for a, b in zip(sommets, sommets[1:]):
        sens = 1 if z[b] > z[a] else -1  # une descente est une montée dans l'autre sens
        idx = np.arange(a, b + 1) if sens > 0 else np.arange(b, a - 1, -1)
        dd = np.abs(d[idx] - d[idx[0]])
        for i, k in decouper_montee(dd, z[idx], pente_min / 2, plat, plat_long, fenetre):
            par_sens[sens].append((int(idx[i]), int(idx[k])))

    resultat = []
    for sens, liste in par_sens.items():
        liste.sort(key=lambda m: sens * d[m[0]])  # dans l'ordre où on les monte
        fusion: list[tuple[int, int]] = []
        for s, e in liste:
            if fusion:
                s0, e0 = fusion[-1]
                ecart = sens * (d[s] - d[e0])
                chute = z[e0] - z[s]
                pente = (z[e] - z[s0]) / max(abs(d[e] - d[s0]), 1e-9) * 100
                if 0 <= ecart <= fusion_ecart and chute <= fusion_chute and pente >= pente_min:
                    fusion[-1] = (s0, e)
                    continue
            fusion.append((s, e))
        resultat += fusion
    return resultat
