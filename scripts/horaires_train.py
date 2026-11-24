"""Horaires des trains SNCF (TGV INOUI, OUIGO, Intercités, TER), sans clé : un fichier par gare.

Source : « Réseau SNCF TGV, Intercités et TER », horaires théoriques des 151 jours à venir au format
GTFS, publiés chaque jour par SNCF Voyageurs (licence ODbL), sans inscription :
https://transport.data.gouv.fr/datasets/horaires-sncf
GTFS : https://gtfs.org/documentation/schedule/reference/

Sortie (lancée au déploiement du site, pas enregistrée dans le dépôt : les horaires changent chaque jour) :
- `gares.json`    : [[uic, nom, lat, lon], ...] toutes les gares desservies (TER compris) ;
- `services.json` : {"debut": "AAAA-MM-JJ", "jours": n, "s": [bitmap hexadécimal par service]}
                    (bit j = le service circule le jour debut + j) ;
- `<uic>.json`    : passages de la gare, [[train, ordre, arrivée, départ, service, mode, numéro], ...]
                    (heures en minutes depuis minuit, au-delà de 1 440 pour les trains de nuit ;
                    mode 0 TER, 1 TGV INOUI, 2 OUIGO, 3 Intercités, 4 car TER, 5 autre).
L'appli lit les fichiers des gares proches de chez toi et de la course : un même train qui passe
par les deux, dans le bon ordre, un jour où il circule, est un train direct.

    python scripts/horaires_train.py --sortie app/dist/trains/horaires [--zip export.zip]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

URL = "https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip"
MODES = [("TER", re.compile(r"train ter|\bter\b", re.IGNORECASE)), ("TGV INOUI", re.compile(r"inoui|tgv", re.IGNORECASE)),
         ("OUIGO", re.compile(r"ouigo", re.IGNORECASE)), ("Intercités", re.compile(r"intercit", re.IGNORECASE)),
         ("Car TER", re.compile(r"car ter|autocar|\bcar\b", re.IGNORECASE))]
UIC = re.compile(r"(\d{8})$")


def mode_de(texte: str, route_type: str = "2") -> int:
    """Mode d'un train d'après l'identifiant d'arrêt SNCF (« StopPoint:OCETGV INOUI-87686006 ») ou la ligne."""
    t = texte.replace("É", "E")
    for i in (2, 4, 1, 3, 0):  # OUIGO avant TGV, car TER avant TER
        if MODES[i][1].search(t):
            return i
    return 4 if route_type == "3" else 5


def minutes(h: str) -> int:
    """« 25:10:00 » → 1 510 (le GTFS dépasse 24 h pour les trains qui roulent après minuit)."""
    hh, mm, *_ = (h or "0:0").split(":")
    return int(hh) * 60 + int(mm)


def uic_de(stop_id: str) -> str:
    m = UIC.search(stop_id or "")
    return m.group(1) if m else ""


def lire(z: zipfile.ZipFile, nom: str):
    noms = {n.rsplit("/", 1)[-1]: n for n in z.namelist()}
    if nom not in noms:
        return
    with z.open(noms[nom]) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))


def calendriers(z: zipfile.ZipFile) -> dict[str, set[date]]:
    jours: dict[str, set[date]] = defaultdict(set)
    j = lambda s: date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    noms_jours = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for r in lire(z, "calendar.txt"):
        d, fin = j(r["start_date"]), j(r["end_date"])
        while d <= fin:
            if r.get(noms_jours[d.weekday()]) == "1":
                jours[r["service_id"]].add(d)
            d += timedelta(days=1)
    for r in lire(z, "calendar_dates.txt"):
        d = j(r["date"])
        if r["exception_type"] == "1":
            jours[r["service_id"]].add(d)
        else:
            jours[r["service_id"]].discard(d)
    return jours


def construire(z: zipfile.ZipFile, aujourdhui: date | None = None) -> dict:
    # heure de Paris : les horaires SNCF sont en heure locale
    aujourdhui = aujourdhui or datetime.now(ZoneInfo("Europe/Paris")).date()
    jours = calendriers(z)
    debut = aujourdhui
    fin = max((max(d) for d in jours.values() if d), default=debut)
    n = (fin - debut).days + 1
    services: list[str] = []
    indice_service: dict[str, int] = {}
    for sid, ds in jours.items():
        bits = 0
        for d in ds:
            k = (d - debut).days
            if 0 <= k < n:
                bits |= 1 << k
        if bits:
            indice_service[sid] = len(services)
            services.append(format(bits, "x"))
    routes = {r["route_id"]: r for r in lire(z, "routes.txt")}
    trains: dict[str, tuple[int, str, str]] = {}  # trip_id → (service, numéro, route_type)
    for r in lire(z, "trips.txt"):
        if r["service_id"] in indice_service:
            route = routes.get(r.get("route_id", ""), {})
            numero = (r.get("trip_short_name") or r.get("trip_headsign") or "").strip()[:8]
            trains[r["trip_id"]] = (indice_service[r["service_id"]], numero,
                                    f'{route.get("route_type", "2")}|{route.get("route_short_name", "")} {route.get("route_long_name", "")}')
    indice_train: dict[str, int] = {}
    mode_train: dict[int, int] = {}
    par_gare: dict[str, list] = defaultdict(list)
    exemple = None
    for r in lire(z, "stop_times.txt"):
        t = trains.get(r["trip_id"])
        uic = uic_de(r["stop_id"])
        if not t or not uic:
            continue
        exemple = exemple or r
        k = indice_train.setdefault(r["trip_id"], len(indice_train))
        if k not in mode_train:  # le type se lit au premier arrêt et vaut pour tout le train
            route_type, nom_ligne = t[2].split("|", 1)
            mode_train[k] = mode_de(f'{r["stop_id"]} {nom_ligne}', route_type)
        par_gare[uic].append([k, int(r["stop_sequence"]), minutes(r["arrival_time"]), minutes(r["departure_time"]), t[0],
                              mode_train[k], t[1]])
    gares = []
    for r in lire(z, "stops.txt"):
        uic = uic_de(r["stop_id"])
        if uic in par_gare and r.get("location_type") == "1":
            gares.append([uic, r["stop_name"], round(float(r["stop_lat"]), 5), round(float(r["stop_lon"]), 5)])
    connues = {g[0] for g in gares}
    for r in lire(z, "stops.txt"):  # gares sans zone d'arrêt (location_type 1) : on prend l'arrêt lui-même
        uic = uic_de(r["stop_id"])
        if uic in par_gare and uic not in connues:
            connues.add(uic)
            gares.append([uic, r["stop_name"], round(float(r["stop_lat"]), 5), round(float(r["stop_lon"]), 5)])
    return {"debut": debut.isoformat(), "jours": n, "services": services, "par_gare": par_gare, "gares": gares,
            "trains": len(indice_train), "exemple_brut": exemple}


def ecrire(res: dict, sortie: Path) -> None:
    sortie.mkdir(parents=True, exist_ok=True)
    court = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    (sortie / "gares.json").write_text(court(res["gares"]))
    (sortie / "services.json").write_text(court({"debut": res["debut"], "jours": res["jours"], "s": res["services"],
                                                  "source": "SNCF Voyageurs, horaires théoriques GTFS (ODbL)"}))
    for uic, passages in res["par_gare"].items():
        (sortie / f"{uic}.json").write_text(court(sorted(passages, key=lambda p: p[3])))


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sortie", required=True)
    p.add_argument("--zip")
    a = p.parse_args(argv)
    chemin = Path(a.zip) if a.zip else Path("/tmp/horaires_sncf.zip")
    if not a.zip:
        import requests

        for essai in range(4):
            try:
                with requests.get(URL, stream=True, timeout=300) as r:
                    r.raise_for_status()
                    with chemin.open("wb") as f:
                        for m in r.iter_content(1 << 22):
                            f.write(m)
                break
            except Exception as e:  # noqa: BLE001
                print(f"téléchargement raté ({e})", file=sys.stderr)
                time.sleep(10 * (essai + 1))
        else:
            return 1
    with zipfile.ZipFile(chemin) as z:
        res = construire(z)
    ecrire(res, Path(a.sortie))
    tailles = sorted(((f.stat().st_size, f.name) for f in Path(a.sortie).glob("*.json")), reverse=True)
    resume = {"debut": res["debut"], "jours": res["jours"], "services": len(res["services"]), "trains": res["trains"],
              "gares": len(res["gares"]), "fichiers": len(tailles), "total_mo": round(sum(t for t, _ in tailles) / 1e6, 1),
              "plus_gros": tailles[:5], "exemple_brut": res["exemple_brut"],
              "modes": {nom: sum(1 for ps in res["par_gare"].values() for x in ps if x[5] == i) for i, (nom, _) in enumerate(MODES)}}
    print(json.dumps(resume, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
