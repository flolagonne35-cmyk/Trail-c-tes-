"""Revêtement des voies (OpenStreetMap via Overpass) et fond de carte Plan IGN (WMS)."""

from __future__ import annotations

import math
import sys
import time
from collections import Counter
from dataclasses import dataclass, field

import numpy as np
from .geo import Projection, longueurs_cumulees
from .ign import RAYON_TERRE


OVERPASS_URLS = ("https://overpass-api.de/api/interpreter",
                 "https://overpass.kumi.systems/api/interpreter")


WMS_URL = "https://data.geopf.fr/wms-r/wms"


COUCHE_PLAN = "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"


REVETEMENT = {
    "asphalt": "goudronné", "paved": "goudronné", "concrete": "goudronné", "concrete:plates": "goudronné",
    "chipseal": "goudronné", "metal": "goudronné",
    "compacted": "stabilisé", "fine_gravel": "stabilisé",
    "gravel": "gravier", "pebblestone": "gravier", "unpaved": "non revêtu",
    "ground": "terre", "dirt": "terre", "earth": "terre", "mud": "terre",
    "grass": "herbe", "grass_paver": "herbe", "sand": "sable", "rock": "rocher", "stone": "rocher",
    "sett": "pavés", "paving_stones": "pavés", "cobblestone": "pavés", "unhewn_cobblestone": "pavés",
    "wood": "bois", "woodchips": "copeaux",
}


TRACKTYPE = {"grade1": "stabilisé", "grade2": "gravier", "grade3": "terre", "grade4": "terre", "grade5": "herbe"}


TECHNICITE = {
    "excellent": "roulant", "good": "roulant", "intermediate": "correct", "bad": "technique",
    "very_bad": "technique", "horrible": "très technique", "very_horrible": "très technique",
    "impassable": "très technique",
    "hiking": "roulant", "mountain_hiking": "technique", "demanding_mountain_hiking": "très technique",
    "alpine_hiking": "très technique",
}


# repli quand OSM ne dit rien : la nature BD TOPO suffit à distinguer route et chemin
REVETEMENT_BDTOPO = {"route": "goudronné", "piste cyclable": "goudronné", "chemin": "non revêtu",
                     "sentier": "non revêtu"}


@dataclass
class StatsOsm:
    statut: str = "non demandé"
    url: str = ""
    nb_voies: int = 0
    valeurs_surface: dict = field(default_factory=dict)
    erreurs: list = field(default_factory=list)
    duree_s: float = 0.0


def voies_osm(lat0: float, lon0: float, rayon: float, stats: StatsOsm, essais: int = 2) -> list[dict]:
    """Voies OSM (highway=*) avec leurs tags et leur géométrie, via l'API Overpass."""
    import requests

    dlat = math.degrees(rayon / RAYON_TERRE)
    dlon = math.degrees(rayon / (RAYON_TERRE * math.cos(math.radians(lat0))))
    requete = (f"[out:json][timeout:120];way[\"highway\"]"
               f"({lat0 - dlat},{lon0 - dlon},{lat0 + dlat},{lon0 + dlon});out tags geom;")
    t0 = time.monotonic()
    for url in OVERPASS_URLS:
        for essai in range(essais):
            try:
                r = requests.post(url, data={"data": requete}, timeout=180,
                                  headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
                if r.status_code == 200:
                    voies = [e for e in r.json().get("elements", []) if e.get("type") == "way" and e.get("geometry")]
                    stats.statut, stats.url, stats.nb_voies = "ok", url, len(voies)
                    stats.valeurs_surface = dict(Counter(v.get("tags", {}).get("surface", "—") for v in voies)
                                                 .most_common(15))
                    stats.duree_s = round(time.monotonic() - t0, 1)
                    return voies
                stats.erreurs.append(f"{url} HTTP {r.status_code} : {r.text[:200]}")
            except (requests.RequestException, ValueError) as exc:
                stats.erreurs.append(f"{url} {type(exc).__name__} : {exc}")
            print("  ! " + stats.erreurs[-1], file=sys.stderr)
            time.sleep(5 * (essai + 1))
    stats.statut = "échec"
    stats.duree_s = round(time.monotonic() - t0, 1)
    return []


def qualifier_revetement(cotes: list, voies: list[dict], proj: Projection,
                         tolerance: float = 15.0) -> None:
    """Pour chaque côte, tags OSM majoritaires des voies à moins de `tolerance` m de ses points."""
    from scipy.spatial import cKDTree

    pts, idx = [], []
    for k, v in enumerate(voies):
        geo = np.array([[g["lon"], g["lat"]] for g in v["geometry"]])
        xy = np.column_stack(proj.xy(geo[:, 0], geo[:, 1]))
        c = longueurs_cumulees(xy)
        s = np.append(np.arange(0, c[-1], 5.0), c[-1])  # un point tous les 5 m
        pts.append(np.column_stack([np.interp(s, c, xy[:, 0]), np.interp(s, c, xy[:, 1])]))
        idx.append(np.full(len(s), k))
    arbre = cKDTree(np.vstack(pts)) if pts else None
    idx = np.concatenate(idx) if idx else np.zeros(0, int)

    for cote in cotes:
        tags_proches = []
        if arbre is not None:
            lon, lat = np.array(cote.lonlat).T
            dist, j = arbre.query(np.column_stack(proj.xy(lon, lat)), distance_upper_bound=tolerance)
            tags_proches = [voies[idx[n]].get("tags", {}) for n, d in zip(j, dist) if np.isfinite(d)]
            couverture = len(tags_proches) / len(lon)
        else:
            couverture = 0.0
        surfaces = Counter(t["surface"] for t in tags_proches if t.get("surface"))
        types = Counter(t["tracktype"] for t in tags_proches if t.get("tracktype"))
        techs = Counter(t.get("sac_scale") or t.get("smoothness") for t in tags_proches
                        if t.get("sac_scale") or t.get("smoothness"))
        cote.couverture_osm_pct = round(100 * couverture)
        noms = Counter(t["name"] for t in tags_proches if t.get("name"))
        if noms and (not cote.nom or cote.nom.isupper()):  # BD TOPO : vide ou abrégé (« R GAMBETTA »)
            cote.nom = noms.most_common(1)[0][0]
        if surfaces:
            cote.surface_osm = surfaces.most_common(1)[0][0]
            cote.revetement = REVETEMENT.get(cote.surface_osm, cote.surface_osm)
            cote.source_revetement = "OSM surface"
        elif types:
            cote.surface_osm = "tracktype=" + types.most_common(1)[0][0]
            cote.revetement = TRACKTYPE.get(types.most_common(1)[0][0], "non revêtu")
            cote.source_revetement = "OSM tracktype"
        else:
            cote.revetement = REVETEMENT_BDTOPO.get(cote.type_voie, "") + " (supposé)"
            cote.source_revetement = "nature BD TOPO"
        if techs:
            cote.technicite = TECHNICITE.get(techs.most_common(1)[0][0], techs.most_common(1)[0][0])


def fond_plan_ign(proj: Projection, rayon: float, erreurs: list, pixels: int = 1600):
    """Image du Plan IGN couvrant le carré analysé (WMS Géoplateforme), ou None."""
    import io
    import requests
    import matplotlib.image as mpimg

    lon_min, lat_min = proj.lonlat(-rayon, -rayon)
    lon_max, lat_max = proj.lonlat(rayon, rayon)
    params = {"SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap", "LAYERS": COUCHE_PLAN,
              "STYLES": "", "CRS": "EPSG:4326", "BBOX": f"{lat_min},{lon_min},{lat_max},{lon_max}",
              "WIDTH": pixels, "HEIGHT": pixels, "FORMAT": "image/png"}
    try:
        r = requests.get(WMS_URL, params=params, timeout=90)
        if r.status_code == 200 and r.headers.get("Content-Type", "").startswith("image/"):
            return mpimg.imread(io.BytesIO(r.content), format="png")
        erreurs.append(f"WMS Plan IGN HTTP {r.status_code} {r.headers.get('Content-Type')} : {r.text[:200]}")
    except Exception as exc:  # le fond est un bonus : jamais bloquant
        erreurs.append(f"WMS Plan IGN {type(exc).__name__} : {exc}")
    print("  ! " + erreurs[-1], file=sys.stderr)
    return None
