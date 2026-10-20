"""Service de calcul altimétrique de la Géoplateforme IGN (RGE ALTI)."""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field

import numpy as np


API_URL = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"


RESSOURCE_DEFAUT = "ign_rge_alti_wld"


NODATA_IGN = -99999.0  # valeur renvoyée par le service hors couverture


RAYON_TERRE = 6_371_000.0


# Centre de Rennes (place de la Mairie)
RENNES_LAT = 48.1113


RENNES_LON = -1.6800


@dataclass
class StatsApi:
    ressource: str = RESSOURCE_DEFAUT
    requetes: int = 0
    requetes_ok: int = 0
    reessais: int = 0
    lots_en_echec: int = 0
    replis_get: int = 0  # lots refaits en GET après échec du POST
    points_demandes: int = 0
    points_nodata: int = 0
    duree_s: float = 0.0
    codes_http: dict = field(default_factory=dict)
    precisions: dict = field(default_factory=dict)  # champ "acc" renvoyé par l'API
    erreurs: list = field(default_factory=list)
    exemple_reponse: str = ""


def _parser_reponse(donnees: dict, n_attendu: int, stats: StatsApi) -> list[float]:
    """Accepte les deux formats documentés : liste d'objets {lon, lat, z, acc} ou liste de z (zonly)."""
    elev = donnees.get("elevations")
    if not isinstance(elev, list):
        raise ValueError(f"clé 'elevations' absente ou invalide : {str(donnees)[:300]}")
    if len(elev) != n_attendu:
        raise ValueError(f"{len(elev)} altitudes reçues pour {n_attendu} points demandés")
    z = []
    for e in elev:
        if isinstance(e, dict):
            z.append(float(e.get("z", NODATA_IGN)))
            acc = str(e.get("acc", "?"))
            stats.precisions[acc] = stats.precisions.get(acc, 0) + 1
        else:
            z.append(float(e))
    return z


LOT_GET = 150

# Mesuré sur le service réel (20/10/2026) : POST JSON par 5 000 points ≈ 620 points/s, GET par 150
# ≈ 90 à 140 points/s, GET au-delà de ~330 points refusé (414), POST formulaire refusé (500).
METHODE_DEFAUT, LOT_DEFAUT = "POST_JSON", 5000


def altitudes_ign(lat: np.ndarray, lon: np.ndarray, ressource: str, taille_lot: int,
                  pause: float, essais: int, stats: StatsApi, methode: str = "GET",
                  decimales: int = 6, paralleles: int = 1) -> np.ndarray:
    """Interroge l'API par lots. Renvoie un tableau de z (NaN pour les points sans donnée ou en échec).

    `methode` : "GET" (paramètres dans l'URL, ~150 points au plus à 6 décimales : au-delà,
    erreur 414), "POST" (formulaire) ou "POST_JSON" (corps JSON). Un lot POST en échec est refait
    en GET par lots de 150 points.
    `decimales` : 5 décimales ≈ 1 m, ce qui raccourcit l'URL. `paralleles` : requêtes simultanées
    (à garder faible : service public partagé).
    """
    import threading
    from concurrent.futures import ThreadPoolExecutor

    import requests

    local = threading.local()
    verrou = threading.Lock()
    lat_f, lon_f = lat.ravel(), lon.ravel()
    z = np.full(lat_f.size, np.nan)
    stats.ressource = ressource
    stats.points_demandes = int(lat_f.size)
    t0 = time.monotonic()

    def compter(**champs):
        with verrou:
            for k, v in champs.items():
                if k == "code":
                    stats.codes_http[v] = stats.codes_http.get(v, 0) + 1
                elif k == "erreur":
                    stats.erreurs.append(v)
                else:
                    setattr(stats, k, getattr(stats, k) + v)

    def lot(debut: int) -> None:
        fin = min(debut + taille_lot, lat_f.size)
        if not requete(debut, fin, methode) and methode != "GET":
            compter(replis_get=1)
            for sous in range(debut, fin, LOT_GET):
                requete(sous, min(sous + LOT_GET, fin), "GET")
        time.sleep(pause)
        if (debut // taille_lot) % 20 == 0:
            print(f"  {fin}/{lat_f.size} points", flush=True)

    def requete(debut: int, fin: int, methode: str) -> bool:
        if not hasattr(local, "session"):
            local.session = requests.Session()
            local.session.headers["User-Agent"] = "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"
        params = {
            "lon": "|".join(f"{v:.{decimales}f}" for v in lon_f[debut:fin]),
            "lat": "|".join(f"{v:.{decimales}f}" for v in lat_f[debut:fin]),
            "resource": ressource, "delimiter": "|", "indent": "false", "measures": "false", "zonly": "false",
        }
        for essai in range(essais):
            compter(requetes=1)
            try:
                if methode == "POST_JSON":
                    r = local.session.post(API_URL, json=params, timeout=120)
                elif methode == "POST":
                    r = local.session.post(API_URL, data=params, timeout=120)
                else:
                    r = local.session.get(API_URL, params=params, timeout=60)
                compter(code=str(r.status_code))
                if r.status_code == 200:
                    with verrou:
                        if not stats.exemple_reponse:
                            stats.exemple_reponse = r.text[:500]
                        z[debut:fin] = _parser_reponse(r.json(), fin - debut, stats)
                        stats.requetes_ok += 1
                    return True
                message = f"HTTP {r.status_code} lot {debut}-{fin} : {r.text[:300]}"
                reessayable = r.status_code == 429 or r.status_code >= 500
            except (requests.RequestException, ValueError) as exc:
                message = f"{type(exc).__name__} lot {debut}-{fin} : {exc}"
                reessayable = True
            compter(erreur=message)
            print("  ! " + message, file=sys.stderr)
            if not reessayable or essai == essais - 1:
                compter(lots_en_echec=1)
                return False
            compter(reessais=1)
            time.sleep(2 ** (essai + 1))
        return False

    debuts = range(0, lat_f.size, taille_lot)
    if paralleles > 1:
        with ThreadPoolExecutor(paralleles) as ex:
            list(ex.map(lot, debuts))
    else:
        for debut in debuts:
            lot(debut)

    nodata = z <= NODATA_IGN + 1
    stats.points_nodata = int(nodata.sum())
    z[nodata] = np.nan
    stats.duree_s = round(time.monotonic() - t0, 1)
    stats.erreurs = stats.erreurs[:50]  # le rapport reste lisible
    return z.reshape(lat.shape)


# (méthode, points par requête, décimales, requêtes simultanées, nombre de lots)
CONFIGS_DEBIT = (
    ("GET", 150, 6, 1, 3),
    ("GET", 300, 6, 1, 3),   # ~7,2 Ko d'URL : sous la limite (414 constaté à 400 points)
    ("GET", 330, 5, 1, 3),
    ("POST_JSON", 1000, 6, 1, 1),
    ("POST_JSON", 5000, 6, 1, 1),
    ("GET", 150, 6, 4, 8),
)


def mesurer_debit(lat: np.ndarray, lon: np.ndarray, ressource: str = RESSOURCE_DEFAUT,
                  configs=CONFIGS_DEBIT) -> list[dict]:
    """Mesure chaque configuration sur quelques lots : codes HTTP, durée, points par seconde."""
    resultats = []
    for methode, n, decimales, paralleles, lots in configs:
        total = min(n * lots, len(lat))
        stats = StatsApi()
        t0 = time.monotonic()
        z = altitudes_ign(lat[:total], lon[:total], ressource, n, 0, 1, stats, methode, decimales, paralleles)
        duree = time.monotonic() - t0
        ok = int(np.isfinite(z).sum())
        resultats.append({"methode": methode, "taille_lot": n, "decimales": decimales, "paralleles": paralleles,
                          "points": total, "codes_http": stats.codes_http, "duree_s": round(duree, 2),
                          "points_ok": ok, "points_par_s": round(ok / duree, 1) if duree > 0 else None,
                          "erreur": stats.erreurs[0][:200] if stats.erreurs else ""})
        time.sleep(2)
    return resultats
