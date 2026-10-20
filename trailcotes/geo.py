"""Projection locale et outils de géométrie plane (mètres)."""

from __future__ import annotations

import math

import numpy as np
from .ign import RAYON_TERRE


class Projection:
    """Équirectangulaire locale autour du centre, en mètres (suffisant sur une dizaine de km)."""

    def __init__(self, lat0: float, lon0: float):
        self.lat0, self.lon0 = lat0, lon0
        self.kx = RAYON_TERRE * math.cos(math.radians(lat0))

    def xy(self, lon, lat):
        return (np.radians(np.asarray(lon) - self.lon0) * self.kx,
                np.radians(np.asarray(lat) - self.lat0) * RAYON_TERRE)

    def lonlat(self, x, y):
        return (self.lon0 + np.degrees(np.asarray(x) / self.kx),
                self.lat0 + np.degrees(np.asarray(y) / RAYON_TERRE))


def longueurs_cumulees(xy: np.ndarray) -> np.ndarray:
    return np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])


def point_a(xy: np.ndarray, s: float) -> np.ndarray:
    c = longueurs_cumulees(xy)
    s = min(s, c[-1])
    return np.array([np.interp(s, c, xy[:, 0]), np.interp(s, c, xy[:, 1])])


def sous_ligne(xy: np.ndarray, s0: float, s1: float) -> np.ndarray:
    """Portion de la polyligne entre les abscisses s0 et s1 (inversée si s1 < s0)."""
    c = longueurs_cumulees(xy)
    a, b = sorted((float(np.clip(s0, 0, c[-1])), float(np.clip(s1, 0, c[-1]))))
    milieu = xy[(c > a) & (c < b)]
    morceau = np.vstack([point_a(xy, a), milieu, point_a(xy, b)])
    return morceau[::-1] if s1 < s0 else morceau


def echantillonner_ligne(xy: np.ndarray, pas: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Un point tous les `pas` mètres le long de la polyligne : (d, x, y)."""
    c = longueurs_cumulees(xy)
    d = np.unique(np.append(np.arange(0.0, c[-1], pas), c[-1]))
    return d, np.interp(d, c, xy[:, 0]), np.interp(d, c, xy[:, 1])
