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


def altitudes_ign(lat: np.ndarray, lon: np.ndarray, ressource: str, taille_lot: int,
                  pause: float, essais: int, stats: StatsApi, methode: str = "GET") -> np.ndarray:
    """Interroge l'API par lots. Renvoie un tableau de z (NaN pour les points sans donnée ou en échec).

    `methode` : "GET" (paramètres dans l'URL) ou "POST" (formulaire, sans limite de longueur d'URL)."""
    import requests

    session = requests.Session()
    session.headers["User-Agent"] = "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"
    lat_f, lon_f = lat.ravel(), lon.ravel()
    z = np.full(lat_f.size, np.nan)
    stats.ressource = ressource
    stats.points_demandes = int(lat_f.size)
    t0 = time.monotonic()

    for debut in range(0, lat_f.size, taille_lot):
        fin = min(debut + taille_lot, lat_f.size)
        params = {
            "lon": "|".join(f"{v:.6f}" for v in lon_f[debut:fin]),
            "lat": "|".join(f"{v:.6f}" for v in lat_f[debut:fin]),
            "resource": ressource,
            "delimiter": "|",
            "indent": "false",
            "measures": "false",
            "zonly": "false",
        }
        for essai in range(essais):
            stats.requetes += 1
            try:
                if methode == "POST":
                    r = session.post(API_URL, data=params, timeout=120)
                else:
                    r = session.get(API_URL, params=params, timeout=60)
                code = str(r.status_code)
                stats.codes_http[code] = stats.codes_http.get(code, 0) + 1
                if r.status_code == 200:
                    if not stats.exemple_reponse:
                        stats.exemple_reponse = r.text[:500]
                    z[debut:fin] = _parser_reponse(r.json(), fin - debut, stats)
                    stats.requetes_ok += 1
                    break
                message = f"HTTP {r.status_code} lot {debut}-{fin} : {r.text[:300]}"
                reessayable = r.status_code == 429 or r.status_code >= 500
            except (requests.RequestException, ValueError) as exc:
                message = f"{type(exc).__name__} lot {debut}-{fin} : {exc}"
                reessayable = True
            stats.erreurs.append(message)
            print("  ! " + message, file=sys.stderr)
            if not reessayable or essai == essais - 1:
                stats.lots_en_echec += 1
                break
            stats.reessais += 1
            time.sleep(2 ** (essai + 1))
        time.sleep(pause)
        if (debut // taille_lot) % 20 == 0:
            print(f"  {fin}/{lat_f.size} points", flush=True)

    nodata = z <= NODATA_IGN + 1
    stats.points_nodata = int(nodata.sum())
    z[nodata] = np.nan
    stats.duree_s = round(time.monotonic() - t0, 1)
    stats.erreurs = stats.erreurs[:50]  # le rapport reste lisible
    return z.reshape(lat.shape)


def mesurer_debit(lat: np.ndarray, lon: np.ndarray, ressource: str = RESSOURCE_DEFAUT,
                  essais_config=(("GET", 150), ("GET", 400), ("POST", 1000), ("POST", 5000))) -> list[dict]:
    """Une requête par configuration (méthode, taille de lot) : code, durée, points par seconde."""
    resultats = []
    for methode, n in essais_config:
        n = min(n, len(lat))
        stats = StatsApi()
        t0 = time.monotonic()
        z = altitudes_ign(lat[:n], lon[:n], ressource, n, 0, 1, stats, methode)
        duree = time.monotonic() - t0
        ok = int(np.isfinite(z).sum())
        resultats.append({"methode": methode, "taille_lot": n, "codes_http": stats.codes_http,
                          "duree_s": round(duree, 2), "points_ok": ok,
                          "points_par_s": round(ok / duree, 1) if duree > 0 else None,
                          "erreur": stats.erreurs[0][:200] if stats.erreurs else ""})
        time.sleep(1)
    return resultats
