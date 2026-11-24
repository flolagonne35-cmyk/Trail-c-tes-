"""Tests hors réseau des horaires SNCF (scripts/horaires_train.py), sur un petit GTFS inventé."""

import json
import sys
import zipfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import horaires_train as ht

FICHIERS = {
    "stops.txt": "stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station\n"
                 "StopArea:OCE87471003,Rennes,48.1035,-1.6722,1,\n"
                 "StopPoint:OCETGV INOUI-87471003,Rennes,48.1035,-1.6722,0,StopArea:OCE87471003\n"
                 "StopPoint:OCETrain TER-87471003,Rennes,48.1035,-1.6722,0,StopArea:OCE87471003\n"
                 "StopArea:OCE87478404,Laval,48.0763,-0.7614,1,\n"
                 "StopPoint:OCETGV INOUI-87478404,Laval,48.0763,-0.7614,0,StopArea:OCE87478404\n"
                 "StopPoint:OCETrain TER-87476002,Vitré,48.1236,-1.2085,0,\n",
    "routes.txt": "route_id,agency_id,route_short_name,route_long_name,route_type\nR1,A,,Rennes - Paris,2\nR2,A,,Rennes - Laval,2\n",
    "trips.txt": "route_id,service_id,trip_id,trip_headsign,trip_short_name\nR1,S1,T1,8612,8612\nR2,S2,T2,857000,857000\nR2,S3,T3,857002,857002\n",
    "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
                    "S1,1,1,1,1,1,1,1,20261123,20261129\n",
    # S2 : samedi 28 seulement ; S3 : supprimé ce jour-là
    "calendar_dates.txt": "service_id,date,exception_type\nS2,20261128,1\nS3,20261128,1\nS3,20261128,2\nS1,20261125,2\n",
    "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
                      "T1,07:05:00,07:05:00,StopPoint:OCETGV INOUI-87471003,0\n"
                      "T1,07:42:00,07:44:00,StopPoint:OCETGV INOUI-87478404,1\n"
                      "T2,23:50:00,23:50:00,StopPoint:OCETrain TER-87471003,0\n"
                      "T2,24:10:00,24:10:00,StopPoint:OCETrain TER-87476002,1\n"
                      "T2,24:40:00,24:40:00,StopPoint:OCETGV INOUI-87478404,2\n"
                      "T3,10:00:00,10:00:00,StopPoint:OCETrain TER-87471003,0\n",
}


def gtfs(tmp_path):
    z = tmp_path / "g.zip"
    with zipfile.ZipFile(z, "w") as f:
        for nom, texte in FICHIERS.items():
            f.writestr(nom, texte)
    return zipfile.ZipFile(z)


def test_modes_et_heures():
    assert ht.mode_de("StopPoint:OCETGV INOUI-87686006") == 1
    assert ht.mode_de("StopPoint:OCEOUIGO-87686006") == 2
    assert ht.mode_de("StopPoint:OCETrain TER-87471003") == 0
    assert ht.mode_de("StopPoint:OCECar TER-87471003") == 4
    assert ht.mode_de("StopPoint:OCEINTERCITES-87547000") == 3
    assert ht.minutes("24:10:00") == 1450
    assert ht.uic_de("StopArea:OCE87471003") == "87471003"


def test_construction(tmp_path):
    res = ht.construire(gtfs(tmp_path), date(2026, 11, 23))
    assert res["debut"] == "2026-11-23" and res["jours"] == 7
    gares = {g[0]: g[1] for g in res["gares"]}
    assert gares == {"87471003": "Rennes", "87478404": "Laval", "87476002": "Vitré"}
    rennes = res["par_gare"]["87471003"]
    assert len(rennes) == 2  # T3 ne circule jamais (ajouté puis supprimé) : écarté
    tgv = next(p for p in rennes if p[6] == "8612")
    assert tgv[3] == 7 * 60 + 5 and tgv[5] == 1
    bits = int(res["services"][tgv[4]], 16)
    assert [bool(bits >> j & 1) for j in range(7)] == [True, True, False, True, True, True, True]  # pas le 25
    ter = next(p for p in res["par_gare"]["87478404"] if p[6] == "857000")
    assert ter[2] == 24 * 60 + 40 and ter[5] == 0


def test_ecriture(tmp_path):
    res = ht.construire(gtfs(tmp_path), date(2026, 11, 23))
    ht.ecrire(res, tmp_path / "h")
    assert json.loads((tmp_path / "h/services.json").read_text())["jours"] == 7
    assert len(json.loads((tmp_path / "h/87478404.json").read_text())) == 2
