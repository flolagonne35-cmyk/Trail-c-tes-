"""Tronçons BD TOPO (WFS Géoplateforme) : lecture, raccordement en voies, graphe du réseau."""

from __future__ import annotations

import math
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from .geo import Projection, longueurs_cumulees, point_a, sous_ligne
from .ign import RAYON_TERRE


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


@dataclass
class Troncon:
    id: str
    nature: str
    type_voie: str
    nom: str
    ouvrage: bool  # pont ou tunnel : l'altitude du MNT n'est pas celle de la voie
    xy: np.ndarray
    longueur: float


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
    exclus_acces: int = 0
    valeurs_acces: dict = field(default_factory=dict)
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


# nom complet d'abord (« Rue Gambetta »), l'abréviation historique (« R GAMBETTA ») en dernier
CHAMPS_NOM = ("nom_collaboratif_gauche", "nom_collaboratif_droite", "nom_voie_ban_gauche",
              "nom_voie_ban_droite", "nom_1_gauche", "nom_1_droite")


def acces_pieton_ok(p: dict) -> bool:
    """Écarte les voies privées et celles dont l'accès piéton est interdit ou réservé.

    Le sens de circulation est ignoré : il ne s'applique pas à un coureur."""
    if p.get("prive") is True or str(p.get("prive")).lower() in ("true", "oui", "1"):
        return False
    acces = str(p.get("acces_pieton") or "").lower()
    return not any(m in acces for m in ("interdit", "impossible", "restreint", "ayants droit"))


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
        acces = f"prive={p.get('prive')} / acces_pieton={p.get('acces_pieton')}"
        stats.valeurs_acces[acces] = stats.valeurs_acces.get(acces, 0) + 1
        if not acces_pieton_ok(p):
            stats.exclus_acces += 1
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
            nom = next((str(p[k]) for k in CHAMPS_NOM if p.get(k)), "")
            troncons.append(Troncon(
                id=f"{p.get('cleabs') or f.get('id')}" + (f"#{n}" if n else ""),
                nature=nature, type_voie=type_voie, nom=nom,
                ouvrage=_est_ouvrage(p.get("position_par_rapport_au_sol")),
                xy=xy, longueur=longueur))
    stats.natures = dict(natures.most_common())
    stats.troncons_retenus = len(troncons)
    return troncons


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
        self.arete: dict[tuple[int, int], int] = {}  # arête → tronçon le plus court
        for k, (a, b, L) in enumerate(zip(self.a, self.b, self.L)):
            cle = (min(a, b), max(a, b))
            if L < aretes.get(cle, math.inf):
                aretes[cle], self.arete[cle] = L, k
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
        k, off, dist = self.projeter(x, y)
        px, py = point_a(self.troncons[k].xy, off)
        da, db = dijkstra(self.graphe, directed=False, indices=[self.a[k], self.b[k]])
        self.base = np.minimum(da + off, db + (self.L[k] - off))
        self.accroche = (k, off)
        return {"troncon": self.troncons[k].id, "nature": self.troncons[k].nature,
                "x": float(px), "y": float(py), "distance_m": dist}

    def distance(self, k: int, off: float) -> float:
        d = min(self.base[self.a[k]] + off, self.base[self.b[k]] + self.L[k] - off)
        if k == self.accroche[0]:
            d = min(d, abs(off - self.accroche[1]))
        return float(d)

    def projeter(self, x: float, y: float) -> tuple[int, float, float]:
        """(tronçon, abscisse sur le tronçon, distance) du point du réseau le plus proche."""
        p0, p1 = self.segments[:, 0:2], self.segments[:, 2:4]
        v = p1 - p0
        l2 = np.maximum((v ** 2).sum(1), 1e-9)
        t = np.clip(((np.array([x, y]) - p0) * v).sum(1) / l2, 0, 1)
        proj = p0 + v * t[:, None]
        dist = np.hypot(proj[:, 0] - x, proj[:, 1] - y)
        s = int(np.argmin(dist))
        return int(self.segments[s, 5]), float(self.segments[s, 4] + t[s] * math.sqrt(l2[s])), float(dist[s])

    def chemin(self, depart: tuple[float, float], arrivee: tuple[float, float]) -> np.ndarray | None:
        """Plus court chemin par le réseau entre deux points (x, y) : polyligne, ou None."""
        k0, t0, _ = self.projeter(*depart)
        k1, t1, _ = self.projeter(*arrivee)
        L0, L1 = self.L[k0], self.L[k1]
        xy0, xy1 = self.troncons[k0].xy, self.troncons[k1].xy
        sorties = [(self.a[k0], t0, sous_ligne(xy0, t0, 0)), (self.b[k0], L0 - t0, sous_ligne(xy0, t0, L0))]
        entrees = [(self.a[k1], t1, sous_ligne(xy1, 0, t1)), (self.b[k1], L1 - t1, sous_ligne(xy1, L1, t1))]
        meilleur = (abs(t1 - t0), None) if k0 == k1 else (math.inf, None)
        for n0, c0, g0 in sorties:
            dist, pred = dijkstra(self.graphe, directed=False, indices=n0, return_predecessors=True)
            for n1, c1, g1 in entrees:
                total = c0 + dist[n1] + c1
                if total < meilleur[0]:
                    meilleur = (total, (n0, n1, g0, g1, pred))
        if not math.isfinite(meilleur[0]):
            return None
        if meilleur[1] is None:
            return sous_ligne(xy0, t0, t1)
        n0, n1, g0, g1, pred = meilleur[1]
        noeuds = [n1]
        while noeuds[-1] != n0:
            noeuds.append(pred[noeuds[-1]])
        noeuds.reverse()
        morceaux = [g0]
        for u, v in zip(noeuds, noeuds[1:]):
            k = self.arete[(min(u, v), max(u, v))]
            xy = self.troncons[k].xy
            morceaux.append(xy if self.a[k] == u else xy[::-1])
        morceaux.append(g1)
        return np.vstack([m for m in morceaux if len(m)])
