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
     par le réseau.

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
import math
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy import ndimage
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cotes_rennes import (  # noqa: E402
    RAYON_TERRE, RENNES_LAT, RENNES_LON, RESSOURCE_DEFAUT, StatsApi, altitudes_ign,
)

WFS_URL = "https://data.geopf.fr/wfs/ows"
COUCHE = "BDTOPO_V3:troncon_de_route"

# nature BD TOPO → type de voie affiché. Les natures absentes sont ignorées :
# Type autoroutier, Bretelle, Rond-point, Bac ou liaison maritime, Escalier.
TYPE_VOIE = {
    "Route à 1 chaussée": "route",
    "Route à 2 chaussées": "route",
    "Route empierrée": "chemin",
    "Chemin": "chemin",
    "Sentier": "sentier",
    "Piste cyclable": "piste cyclable",
}


# --------------------------------------------------------------------------- géométrie

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


@dataclass
class Troncon:
    id: str
    nature: str
    type_voie: str
    nom: str
    ouvrage: bool  # pont ou tunnel : l'altitude du MNT n'est pas celle de la voie
    xy: np.ndarray
    longueur: float


# --------------------------------------------------------------------------- WFS BD TOPO

@dataclass
class StatsWfs:
    requetes: int = 0
    codes_http: dict = field(default_factory=dict)
    erreurs: list = field(default_factory=list)
    nb_objets: int = 0
    ordre_bbox: str = ""
    axes_inverses: bool = False
    natures: dict = field(default_factory=dict)
    troncons_retenus: int = 0
    exemple_proprietes: dict = field(default_factory=dict)
    duree_s: float = 0.0


def _wfs_get(session, params: dict, essais: int, stats: StatsWfs):
    """Renvoie le JSON, ou None après échec (les 4xx ne sont pas réessayés)."""
    import requests

    for essai in range(essais):
        stats.requetes += 1
        try:
            r = session.get(WFS_URL, params=params, timeout=90)
            code = str(r.status_code)
            stats.codes_http[code] = stats.codes_http.get(code, 0) + 1
            if r.status_code == 200:
                return r.json()
            message = f"HTTP {r.status_code} startIndex={params.get('STARTINDEX')} : {r.text[:300]}"
            reessayable = r.status_code == 429 or r.status_code >= 500
        except (requests.RequestException, ValueError) as exc:
            message = f"{type(exc).__name__} startIndex={params.get('STARTINDEX')} : {exc}"
            reessayable = True
        stats.erreurs.append(message)
        print("  ! " + message, file=sys.stderr)
        if not reessayable:
            return None
        time.sleep(2 ** (essai + 1))
    return None


def troncons_wfs(lat0: float, lon0: float, rayon: float, stats: StatsWfs,
                 taille_page: int = 1000, essais: int = 4, pause: float = 0.2) -> list[dict]:
    """Objets GeoJSON de la couche, paginés. Essaie l'ordre d'axes WFS 2.0 (lat,lon) puis lon,lat."""
    import requests

    session = requests.Session()
    session.headers["User-Agent"] = "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"
    dlat = math.degrees(rayon / RAYON_TERRE)
    dlon = math.degrees(rayon / (RAYON_TERRE * math.cos(math.radians(lat0))))
    variantes = {
        "lat,lon EPSG:4326": f"{lat0 - dlat},{lon0 - dlon},{lat0 + dlat},{lon0 + dlon},urn:ogc:def:crs:EPSG::4326",
        "lon,lat CRS84": f"{lon0 - dlon},{lat0 - dlat},{lon0 + dlon},{lat0 + dlat},urn:ogc:def:crs:OGC:1.3:CRS84",
    }
    t0 = time.monotonic()
    for nom, bbox in variantes.items():
        objets: dict[str, dict] = {}
        debut = 0
        while debut < 500_000:
            params = {
                "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
                "TYPENAMES": COUCHE, "SRSNAME": "EPSG:4326", "OUTPUTFORMAT": "application/json",
                "BBOX": bbox, "COUNT": taille_page, "STARTINDEX": debut,
            }
            donnees = _wfs_get(session, params, essais, stats)
            page = (donnees or {}).get("features") or []
            for i, f in enumerate(page):
                cle = str((f.get("properties") or {}).get("cleabs") or f.get("id") or f"{debut + i}")
                objets[cle] = f
            print(f"  WFS {nom} : {len(objets)} tronçons", flush=True)
            if len(page) < taille_page:
                break
            debut += taille_page
            time.sleep(pause)
        if objets:
            stats.ordre_bbox = nom
            stats.nb_objets = len(objets)
            stats.duree_s = round(time.monotonic() - t0, 1)
            return list(objets.values())
    stats.duree_s = round(time.monotonic() - t0, 1)
    return []


def axes_inverses(features: list[dict], lat0: float, lon0: float) -> bool:
    """True si les coordonnées arrivent en (lat, lon) au lieu de (lon, lat)."""
    for f in features:
        coords = (f.get("geometry") or {}).get("coordinates")
        while isinstance(coords, list) and coords and isinstance(coords[0], list):
            coords = coords[0]
        if coords and len(coords) >= 2:
            a, b = coords[0], coords[1]
            return abs(a - lat0) + abs(b - lon0) < abs(a - lon0) + abs(b - lat0)
    return False


def _est_ouvrage(position) -> bool:
    try:
        return int(str(position).strip()) != 0
    except (TypeError, ValueError):
        return False


def lire_troncons(features: list[dict], proj: Projection, inverse: bool, stats: StatsWfs) -> list[Troncon]:
    natures: Counter = Counter()
    troncons = []
    for f in features:
        p = f.get("properties") or {}
        if not stats.exemple_proprietes and p:
            stats.exemple_proprietes = {k: v for k, v in p.items() if not isinstance(v, (dict, list))}
        nature = str(p.get("nature") or "?")
        natures[nature] += 1
        type_voie = TYPE_VOIE.get(nature)
        etat = str(p.get("etat_de_l_objet") or "").lower()
        if type_voie is None or "projet" in etat or "construction" in etat:
            continue
        geom = f.get("geometry") or {}
        lignes = {"LineString": [geom.get("coordinates")],
                  "MultiLineString": geom.get("coordinates")}.get(geom.get("type"), [])
        for n, ligne in enumerate(lignes or []):
            if not ligne or len(ligne) < 2:
                continue
            arr = np.array([c[:2] for c in ligne], dtype=float)
            if inverse:
                arr = arr[:, ::-1]
            xy = np.column_stack(proj.xy(arr[:, 0], arr[:, 1]))
            longueur = float(longueurs_cumulees(xy)[-1])
            if longueur < 1:
                continue
            nom = next((str(p[k]) for k in ("nom_1_gauche", "nom_1_droite", "nom_collaboratif_gauche")
                        if p.get(k)), "")
            troncons.append(Troncon(
                id=f"{p.get('cleabs') or f.get('id')}" + (f"#{n}" if n else ""),
                nature=nature, type_voie=type_voie, nom=nom,
                ouvrage=_est_ouvrage(p.get("position_par_rapport_au_sol")),
                xy=xy, longueur=longueur))
    stats.natures = dict(natures.most_common())
    stats.troncons_retenus = len(troncons)
    return troncons


# --------------------------------------------------------------------------- réseau

def cle_noeud(pt) -> tuple[float, float]:
    return (round(float(pt[0]), 1), round(float(pt[1]), 1))


def chainer(troncons: list[Troncon], angle_max: float = 45.0) -> list[list[tuple[int, bool]]]:
    """Raccorde les tronçons en voies : liste de (indice, parcouru à l'envers)."""
    incidences = defaultdict(list)
    for i, t in enumerate(troncons):
        incidences[cle_noeud(t.xy[0])].append((i, 0))
        incidences[cle_noeud(t.xy[-1])].append((i, 1))

    def direction(i: int, bout: int) -> np.ndarray:
        xy = troncons[i].xy if bout == 0 else troncons[i].xy[::-1]
        v = point_a(xy, 20.0) - xy[0]
        return v / (np.hypot(*v) or 1.0)

    lien: dict[tuple[int, int], tuple[int, int]] = {}
    for bouts in incidences.values():
        candidats = []
        for a in range(len(bouts)):
            for b in range(a + 1, len(bouts)):
                (i, ei), (j, ej) = bouts[a], bouts[b]
                if i == j or troncons[i].type_voie != troncons[j].type_voie:
                    continue
                angle = math.degrees(math.acos(float(np.clip(direction(i, ei) @ direction(j, ej), -1, 1))))
                deviation = 180.0 - angle
                if deviation <= angle_max:
                    candidats.append((deviation, bouts[a], bouts[b]))
        pris = set()
        for _, u, v in sorted(candidats):
            if u not in pris and v not in pris:
                lien[u], lien[v] = v, u
                pris |= {u, v}

    vus = [False] * len(troncons)
    chaines = []
    for depart in range(len(troncons)):
        if vus[depart]:
            continue
        cur, deja = (depart, 0), {depart}
        while cur in lien:  # remonte jusqu'à un bout libre (ou fait le tour d'une boucle)
            j, ej = lien[cur]
            if j in deja:
                break
            deja.add(j)
            cur = (j, 1 - ej)
        chaine = []
        t, entree = cur
        while not vus[t]:
            vus[t] = True
            chaine.append((t, entree == 1))
            sortie = (t, 1 - entree)
            if sortie not in lien:
                break
            t, entree = lien[sortie]
        chaines.append(chaine)
    return chaines


@dataclass
class Voie:
    troncons: list[tuple[int, bool]]
    d: np.ndarray        # distance le long de la voie (m)
    x: np.ndarray
    y: np.ndarray
    troncon: np.ndarray  # indice du tronçon de chaque point
    offset: np.ndarray   # position du point sur ce tronçon, dans son sens d'origine (m)
    ouvrage: np.ndarray
    z: np.ndarray | None = None


def echantillonner(chaine: list[tuple[int, bool]], troncons: list[Troncon], pas: float) -> Voie:
    morceaux, debuts, longueurs = [], [], []
    total = 0.0
    for k, (i, envers) in enumerate(chaine):
        xy = troncons[i].xy[::-1] if envers else troncons[i].xy
        morceaux.append(xy if k == 0 else xy[1:])
        debuts.append(total)
        longueurs.append(troncons[i].longueur)
        total += troncons[i].longueur
    xy = np.vstack(morceaux)
    c = longueurs_cumulees(xy)
    d = np.unique(np.append(np.arange(0.0, c[-1], pas), c[-1]))
    k = np.clip(np.searchsorted(debuts, d, side="right") - 1, 0, len(chaine) - 1)
    local = np.clip(d - np.asarray(debuts)[k], 0, None)
    idx = np.array([chaine[j][0] for j in k])
    envers = np.array([chaine[j][1] for j in k])
    L = np.asarray(longueurs)[k]
    return Voie(
        troncons=chaine, d=d,
        x=np.interp(d, c, xy[:, 0]), y=np.interp(d, c, xy[:, 1]),
        troncon=idx, offset=np.where(envers, L - local, local),
        ouvrage=np.array([troncons[i].ouvrage for i in idx]))


class Reseau:
    """Graphe des tronçons pour accrocher une position et mesurer des distances par les chemins."""

    def __init__(self, troncons: list[Troncon]):
        self.troncons = troncons
        noeuds: dict[tuple[float, float], int] = {}
        self.a = np.array([noeuds.setdefault(cle_noeud(t.xy[0]), len(noeuds)) for t in troncons])
        self.b = np.array([noeuds.setdefault(cle_noeud(t.xy[-1]), len(noeuds)) for t in troncons])
        self.L = np.array([t.longueur for t in troncons])
        aretes: dict[tuple[int, int], float] = {}
        for a, b, L in zip(self.a, self.b, self.L):
            cle = (min(a, b), max(a, b))
            aretes[cle] = min(L, aretes.get(cle, math.inf))
        n = len(noeuds)
        if aretes:
            i, j = np.array(list(aretes.keys())).T
            w = np.maximum(np.array(list(aretes.values())), 1e-3)  # csgraph ignore les poids nuls
            self.graphe = csr_matrix((np.r_[w, w], (np.r_[i, j], np.r_[j, i])), shape=(n, n))
        else:
            self.graphe = csr_matrix((n, n))
        segs = []
        for k, t in enumerate(troncons):
            c = longueurs_cumulees(t.xy)
            segs.append(np.column_stack([t.xy[:-1], t.xy[1:], c[:-1], np.full(len(c) - 1, k)]))
        self.segments = np.vstack(segs) if segs else np.zeros((0, 6))
        self.base = None

    def accrocher(self, x: float, y: float) -> dict:
        """Projette (x, y) sur le tronçon le plus proche et calcule les distances à tous les nœuds."""
        p0, p1 = self.segments[:, 0:2], self.segments[:, 2:4]
        v = p1 - p0
        l2 = np.maximum((v ** 2).sum(1), 1e-9)
        t = np.clip(((np.array([x, y]) - p0) * v).sum(1) / l2, 0, 1)
        proj = p0 + v * t[:, None]
        dist = np.hypot(proj[:, 0] - x, proj[:, 1] - y)
        s = int(np.argmin(dist))
        k = int(self.segments[s, 5])
        off = float(self.segments[s, 4] + t[s] * math.sqrt(l2[s]))
        da, db = dijkstra(self.graphe, directed=False, indices=[self.a[k], self.b[k]])
        self.base = np.minimum(da + off, db + (self.L[k] - off))
        self.accroche = (k, off)
        return {"troncon": self.troncons[k].id, "nature": self.troncons[k].nature,
                "x": float(proj[s, 0]), "y": float(proj[s, 1]), "distance_m": float(dist[s])}

    def distance(self, k: int, off: float) -> float:
        d = min(self.base[self.a[k]] + off, self.base[self.b[k]] + self.L[k] - off)
        if k == self.accroche[0]:
            d = min(d, abs(off - self.accroche[1]))
        return float(d)


# --------------------------------------------------------------------------- profil et côtes

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
    profil_d: list = field(repr=False, default_factory=list)
    profil_z: list = field(repr=False, default_factory=list)
    lonlat: list = field(repr=False, default_factory=list)


def pentes_par_tranche(d: np.ndarray, z: np.ndarray, tranche: float = 50.0) -> list[float]:
    bornes = np.arange(d[0], d[-1], tranche)
    if len(bornes) > 1 and d[-1] - bornes[-1] < tranche * 0.4:
        bornes = bornes[:-1]  # dernière tranche trop courte : rattachée à la précédente
    bornes = np.append(bornes, d[-1])
    zb = np.interp(bornes, d, z)
    return [round(float(v), 1) for v in np.diff(zb) / np.diff(bornes) * 100]


def cotes_de_voie(voie: Voie, troncons: list[Troncon], proj: Projection, reseau: Reseau,
                  args: argparse.Namespace) -> list[Cote]:
    d, z = voie.d, voie.z
    sommets = extrema(z, args.tolerance)
    cotes = []
    for a, b in zip(sommets, sommets[1:]):
        # une descente dans le sens de la voie est une montée dans l'autre sens
        idx = np.arange(a, b + 1) if z[b] > z[a] else np.arange(b, a - 1, -1)
        dd = np.abs(d[idx] - d[idx[0]])
        zz = z[idx]
        for i, k in decouper_montee(dd, zz, args.pente_min / 2, args.plat, args.plat_long, 50.0):
            L = dd[k] - dd[i]
            pente = (zz[k] - zz[i]) / L * 100 if L > 0 else 0
            dplus = float(np.clip(np.diff(zz[i:k + 1]), 0, None).sum())
            if L < args.longueur_min or pente < args.pente_min or dplus < args.dplus_min:
                continue
            sel = idx[i:k + 1]
            lon, lat = proj.lonlat(voie.x[sel], voie.y[sel])
            pentes = pentes_par_tranche(dd[i:k + 1], zz[i:k + 1])
            t_dep = troncons[voie.troncon[sel[0]]]
            natures = Counter(troncons[t].nature for t in voie.troncon[sel])
            noms = Counter(troncons[t].nom for t in voie.troncon[sel] if troncons[t].nom)
            cotes.append(Cote(
                id=0,
                distance_m=round(reseau.distance(int(voie.troncon[sel[0]]), float(voie.offset[sel[0]]))),
                longueur_m=round(float(L)),
                pente_moy_pct=round(float(pente), 1),
                pente_max_pct=max(pentes),
                dplus_m=round(dplus, 1),
                alt_depart_m=round(float(zz[i]), 1),
                alt_arrivee_m=round(float(zz[k]), 1),
                type_voie=t_dep.type_voie,
                nature=natures.most_common(1)[0][0],
                nom=noms.most_common(1)[0][0] if noms else "",
                lat_depart=round(float(lat[0]), 6), lon_depart=round(float(lon[0]), 6),
                lat_arrivee=round(float(lat[-1]), 6), lon_arrivee=round(float(lon[-1]), 6),
                pentes_50m=pentes,
                profil_d=[round(float(v - dd[i]), 1) for v in dd[i:k + 1]],
                profil_z=[round(float(v), 2) for v in zz[i:k + 1]],
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


def dessiner_carte(chemin: Path, troncons, cotes, proj, accroche, rayon, pente_min, titre) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import LineCollection
    from matplotlib.colors import Normalize

    fig, ax = plt.subplots(figsize=(10, 10), dpi=120)
    styles = {"route": ("#9a9a9a", 0.9), "chemin": ("#b08a5a", 0.8), "sentier": ("#7a9a6a", 0.8),
              "piste cyclable": ("#6a8fb0", 0.8)}
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

def analyser(args: argparse.Namespace) -> int:
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    proj = Projection(args.lat, args.lon)
    wfs, alti = StatsWfs(), StatsApi(ressource=args.ressource)

    if args.demo:
        features = reseau_fictif(proj, args.rayon)
        source = "réseau et relief fictifs (--demo)"
    else:
        features = troncons_wfs(args.lat, args.lon, args.rayon, wfs, essais=args.essais)
        source = f"IGN Géoplateforme : {COUCHE} + {args.ressource}"
    wfs.axes_inverses = axes_inverses(features, args.lat, args.lon)
    troncons = lire_troncons(features, proj, wfs.axes_inverses, wfs)
    print(f"{len(features)} tronçons reçus, {len(troncons)} retenus")

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

    reseau = Reseau(troncons)
    accroche = reseau.accrocher(0.0, 0.0)
    lon_a, lat_a = proj.lonlat(accroche["x"], accroche["y"])
    accroche.update(lat=round(float(lat_a), 6), lon=round(float(lon_a), 6),
                    distance_m=round(accroche["distance_m"], 1))
    print(f"Position accrochée à {accroche['distance_m']} m, sur « {accroche['nature']} »")

    voies = [echantillonner(ch, troncons, args.pas) for ch in chainer(troncons, args.angle_max)]
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
                            args.pause, args.essais, alti) if len(uniques) else np.zeros(0)
    z = np.full(len(x), np.nan)
    z[sol] = z_u[inverse.ravel()]
    taux_valide = float(np.isfinite(z_u).mean()) if len(z_u) else 0.0

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

    ecrire_csv(sortie / "cotes.csv", cotes)
    ecrire_geojson(sortie / "cotes.geojson", cotes, accroche)
    titre = (f"Côtes ≥ {args.pente_min:g} % sur ≥ {args.longueur_min:g} m autour de "
             f"({args.lat:.4f}, {args.lon:.4f}) — {len(cotes)} côtes\nSource : {source}")
    dessiner_carte(sortie / "carte.png", troncons, cotes, proj, accroche, args.rayon, args.pente_min, titre)

    echec = (1 - taux_valide) > args.max_echec
    rapport.update(
        statut="echec_api" if echec else "ok",
        resume={
            "Tronçons BD TOPO reçus / retenus": f"{len(features)} / {len(troncons)}",
            "Voies raccordées (≥ longueur mini)": len(voies),
            "Points altimétriques demandés": int(len(uniques)),
            "Points valides": f"{100 * taux_valide:.2f} %",
            "Accrochage de la position": f"{accroche['distance_m']} m ({accroche['nature']})",
            "Côtes trouvées": len(cotes),
            "Requêtes WFS / altimétrie": f"{wfs.requetes} / {alti.requetes}",
        },
        accroche=accroche,
        nb_cotes=len(cotes),
        top=[{k: getattr(c, k) for k in ("id", "distance_m", "longueur_m", "pente_moy_pct", "pente_max_pct",
                                         "dplus_m", "type_voie", "nom")} for c in cotes[:10]],
        wfs=None if args.demo else asdict(wfs),
        api=None if args.demo else asdict(alti),
    )
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")

    print(f"{len(cotes)} côtes, {100 * taux_valide:.1f} % de points valides")
    for c in cotes[:8]:
        print(f"  n°{c.id} à {c.distance_m} m : {c.longueur_m} m à {c.pente_moy_pct} % "
              f"(+{c.dplus_m} m, max {c.pente_max_pct} %) — {c.type_voie} {c.nom}")
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
    p.add_argument("--angle-max", type=float, default=45,
                   help="virage maxi pour prolonger une voie à une intersection, en degrés (défaut 45)")
    p.add_argument("--ressource", default=RESSOURCE_DEFAUT)
    p.add_argument("--taille-lot", type=int, default=150)
    p.add_argument("--pause", type=float, default=0.25)
    p.add_argument("--essais", type=int, default=4)
    p.add_argument("--max-echec", type=float, default=0.05)
    p.add_argument("--sortie", default="resultats/rennes_cotes")
    p.add_argument("--demo", action="store_true", help="réseau et relief fictifs, sans appel réseau")
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(analyser(parser_arguments()))
