"""Enrichit le calendrier des courses, chaque jour avec le workflow « Calendrier des courses » :

1. Notoriété : la course a-t-elle un article Wikipédia ? On la cherche sur Wikidata (données sous
   licence CC0, API publique, sans clé) par son nom, on garde l'élément dont la description parle de
   course à pied, et on compte ses articles Wikipédia (« sitelinks ») : 0 = inconnue du grand public,
   1 et plus = connue, 10 et plus = course de renommée internationale. Résultats mis en cache
   (resultats/courses/wikidata_cache.json) : seules les nouvelles courses sont cherchées.
   https://www.wikidata.org/wiki/Wikidata:Data_access

2. Prix des carburants du jour : moyenne nationale des stations (flux instantané officiel, ministère
   de l'Économie, Licence Ouverte), pour estimer le coût du trajet en voiture dans l'appli.
   https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/
"""

from __future__ import annotations

import json
import re
import time
import unicodedata
from pathlib import Path
from typing import Callable

WIKIDATA = "https://www.wikidata.org/w/api.php"
CARBURANTS = ("https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/"
              "prix-des-carburants-en-france-flux-instantane-v2/records")
# repli si le service des carburants ne répond pas (moyennes nationales de 2026, à titre indicatif)
CARBURANTS_REPLI = {"gazole": 1.65, "e10": 1.72, "sp95": 1.78, "source": "valeurs de repli"}

COURSE = re.compile(r"cours|marath|trail|semi|ultra|race|running|foulee|corrida|cross|run\b|ekiden|skyrace|kilometre vertical",
                    re.I)

Recuperer = Callable[[str, dict], dict | None]


def sans_accents(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower()


def nom_recherche(nom: str) -> str:
    """« 12e Trail des Templiers 2026 » → « Trail des Templiers » : sans numéro d'édition ni année."""
    t = re.sub(r"\b(19|20)\d{2}\b", " ", nom)
    t = re.sub(r"\b\d+\s*(e|eme|ème|ᵉ|er|re)\b\s*(edition|édition)?", " ", t, flags=re.I)
    t = re.sub(r"\b(edition|édition)\b", " ", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip(" -–:")


def mots(t: str) -> set[str]:
    return {m for m in re.findall(r"[a-z0-9]+", sans_accents(t)) if len(m) > 2 and m not in {"des", "les", "del", "the"}}


def choisir_entite(resultats: list[dict], nom: str) -> str | None:
    """Premier élément Wikidata dont la description parle de course à pied et dont le libellé
    reprend l'essentiel du nom (au moins 60 % des mots significatifs)."""
    voulus = mots(nom)
    if not voulus:
        return None
    for r in resultats:
        libelle = r.get("label") or ""
        description = r.get("description") or ""
        communs = voulus & mots(libelle + " " + " ".join(r.get("aliases") or []))
        # la description dit ce qu'est l'élément (« marathon annuel », « association ») ; sans description, le libellé
        if COURSE.search(sans_accents(description or libelle)) and len(communs) / len(voulus) >= 0.6:
            return r.get("id")
    return None


def notoriete(courses: list[dict], cache: dict, recuperer: Recuperer, max_nouvelles: int = 500, pause_s: float = 0.2) -> dict:
    """Ajoute `connue` (nombre d'articles Wikipédia) aux courses présentes sur Wikipédia. Renvoie le cache à jour."""
    noms = sorted({nom_recherche(c["nom"]) for c in courses} - set(cache))[:max_nouvelles]
    trouves: dict[str, str] = {}
    for n in noms:
        if not n:
            continue
        j = recuperer(WIKIDATA, {"action": "wbsearchentities", "search": n, "language": "fr", "uselang": "fr",
                                 "type": "item", "limit": "7", "format": "json"})
        if j is None:
            continue  # réseau : on réessaiera demain
        q = choisir_entite(j.get("search") or [], n)
        cache[n] = None
        if q:
            trouves[n] = q
        time.sleep(pause_s)
    # nombre d'articles Wikipédia, par lots de 50
    ids = sorted(set(trouves.values()))
    liens: dict[str, int] = {}
    for i in range(0, len(ids), 50):
        j = recuperer(WIKIDATA, {"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]), "props": "sitelinks", "format": "json"})
        for q, e in ((j or {}).get("entities") or {}).items():
            liens[q] = sum(1 for k in (e.get("sitelinks") or {}) if k.endswith("wiki") and k not in {"commonswiki", "specieswiki"})
    for n, q in trouves.items():
        cache[n] = {"qid": q, "wikipedia": liens.get(q, 0)}
    for c in courses:
        e = cache.get(nom_recherche(c["nom"]))
        if e and e.get("wikipedia", 0) >= 1:
            c["connue"] = e["wikipedia"]
            c["wikidata"] = e["qid"]
    return cache


def prix_carburants(recuperer: Recuperer) -> dict:
    """Prix moyens du jour (€/L) en France : gazole, SP95-E10, SP95 ; repli si le service ne répond pas."""
    j = recuperer(CARBURANTS, {"select": "avg(gazole_prix) as gazole, avg(e10_prix) as e10, avg(sp95_prix) as sp95", "limit": "1"})
    try:
        r = (j or {}).get("results")[0]
        prix = {k: round(float(r[k]), 3) for k in ("gazole", "e10", "sp95") if r.get(k)}
        if prix.get("gazole") and 0.8 < prix["gazole"] < 3:
            return {**CARBURANTS_REPLI, **prix, "source": "prix-carburants.gouv.fr (moyenne nationale)"}
    except (TypeError, IndexError, KeyError, ValueError):
        pass
    return dict(CARBURANTS_REPLI)


def recuperer_http(url: str, params: dict) -> dict | None:
    import requests
    for i in range(3):
        try:
            r = requests.get(url, params=params, timeout=60,
                             headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001 - réseau : on réessaie, puis on passe
            print(f"  {url} : {e}", flush=True)
            time.sleep(3 * (i + 1))
    return None


def enrichir(courses: list[dict], dossier_cache: Path, sortie_carburants: Path, recuperer: Recuperer = recuperer_http) -> dict:
    """Notoriété (avec cache) et prix des carburants ; renvoie un résumé pour le rapport."""
    chemin = dossier_cache / "wikidata_cache.json"
    cache = json.loads(chemin.read_text()) if chemin.exists() else {}
    cache = notoriete(courses, cache, recuperer)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True) + "\n")
    carbu = prix_carburants(recuperer)
    carbu["date"] = time.strftime("%Y-%m-%d")
    sortie_carburants.parent.mkdir(parents=True, exist_ok=True)
    sortie_carburants.write_text(json.dumps(carbu, ensure_ascii=False) + "\n")
    connues = [c for c in courses if c.get("connue")]
    return {"connues": len(connues), "exemples_connues": [f'{c["nom"]} ({c["connue"]} Wikipédia)' for c in connues[:20]],
            "cache_wikidata": len(cache), "carburants": carbu}
