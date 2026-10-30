#!/usr/bin/env python3
"""Vérifie sur les services réels ce que l'application attend du géocodage et du calcul d'itinéraire.

L'application (app/src/calcul/geoservices.ts) appelle directement :
  - https://data.geopf.fr/geocodage/search   (ville, adresse → position)
  - https://data.geopf.fr/geocodage/reverse  (position → adresse du pied de la côte)
  - https://data.geopf.fr/navigation/itineraire (voiture et piéton, distance en m, durée en min)

Ce script fait les mêmes requêtes, applique les mêmes règles de lecture et garde un extrait des
réponses brutes dans rapport.json, pour corriger l'application si un format change.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

GEOCODAGE = "https://data.geopf.fr/geocodage"
ITINERAIRE = "https://data.geopf.fr/navigation/itineraire"
MAIRIE_RENNES = (48.1113, -1.6800)
GAMBETTA = (48.110965, -1.674536)  # pied de la côte de la rue Gambetta


def appeler(nom: str, url: str, params: dict, controle) -> dict:
    t0 = time.monotonic()
    try:
        r = requests.get(url, params=params, timeout=30,
                         headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
        corps = r.json() if "json" in r.headers.get("Content-Type", "") else None
        lu = controle(corps) if r.status_code == 200 and corps is not None else None
        return {"service": nom, "http": r.status_code, "duree_s": round(time.monotonic() - t0, 2), "lu": lu,
                "ok": lu not in (None, [], ""), "extrait": r.text[:600]}
    except (requests.RequestException, ValueError) as exc:
        return {"service": nom, "http": None, "ok": False, "erreur": f"{type(exc).__name__}: {exc}"}


def lire_recherche(j):  # mêmes règles que lireRecherche() dans l'application
    return [{"label": f["properties"].get("label"), "lon": f["geometry"]["coordinates"][0],
             "lat": f["geometry"]["coordinates"][1]} for f in j.get("features", [])
            if f.get("geometry", {}).get("coordinates") and f.get("properties", {}).get("label")]


def lire_adresse(j):
    feats = j.get("features") or []
    return feats[0]["properties"].get("label") if feats else None


def lire_itineraire(j):
    try:
        return {"distance_m": float(j["distance"]), "duree_min": float(j["duration"])}
    except (KeyError, TypeError, ValueError):
        return None


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sortie", default="resultats/services")
    args = p.parse_args(argv)
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    dep = f"{MAIRIE_RENNES[1]},{MAIRIE_RENNES[0]}"
    arr = f"{GAMBETTA[1]},{GAMBETTA[0]}"
    resultats = [
        appeler("recherche « Rennes mairie »", f"{GEOCODAGE}/search",
                {"q": "Rennes mairie", "limit": 6, "index": "address,poi", "autocomplete": 1,
                 "lat": MAIRIE_RENNES[0], "lon": MAIRIE_RENNES[1]}, lire_recherche),
        appeler("recherche « Bédoin »", f"{GEOCODAGE}/search", {"q": "Bédoin", "limit": 3, "index": "address,poi"},
                lire_recherche),
        appeler("adresse du pied (rue Gambetta)", f"{GEOCODAGE}/reverse",
                {"lat": GAMBETTA[0], "lon": GAMBETTA[1], "index": "address", "limit": 1}, lire_adresse),
    ]
    for profil in ("car", "pedestrian"):
        resultats.append(appeler(f"itinéraire {profil}", ITINERAIRE, {
            "resource": "bdtopo-valhalla", "profile": profil, "optimization": "fastest", "start": dep, "end": arr,
            "distanceUnit": "meter", "timeUnit": "minute", "getSteps": "false", "geometryFormat": "geojson"},
            lire_itineraire))

    for r in resultats:
        print(f"{'OK ' if r['ok'] else '!! '} {r['service']} : HTTP {r.get('http')} → {json.dumps(r.get('lu'), ensure_ascii=False)[:160]}")
    tous_ok = all(r["ok"] for r in resultats)
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "ok" if tous_ok else "echec_service",
        "resume": {r["service"]: ("ok — " if r["ok"] else "ÉCHEC — ") + json.dumps(r.get("lu"), ensure_ascii=False)[:120]
                   for r in resultats},
        "services": resultats,
    }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    return 0 if tous_ok else 2


if __name__ == "__main__":
    sys.exit(main())
