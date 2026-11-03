import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import points_eau as pe  # noqa: E402

ELEMENTS = [
    {"type": "node", "lat": 48.11, "lon": -1.68, "tags": {"amenity": "drinking_water", "name": "Fontaine du parc",
                                                           "seasonal": "yes", "check_date": "2025-06-01"}},
    {"type": "way", "center": {"lat": 48.2, "lon": -1.5}, "tags": {"amenity": "water_point", "drinking_water": "yes"}},
    {"type": "node", "lat": 48.3, "lon": -1.4, "tags": {"man_made": "water_tap", "drinking_water": "yes"}},
    {"type": "node", "lat": 48.4, "lon": -1.3, "tags": {"amenity": "drinking_water", "drinking_water": "no"}},
    {"type": "node", "lat": 48.5, "lon": -1.2, "tags": {"amenity": "drinking_water", "access": "private"}},
    {"type": "node", "lat": 48.11, "lon": -1.68, "tags": {"amenity": "drinking_water"}},  # doublon
]


def test_cases_couvrent_france_et_outre_mer():
    c = pe.cases()
    assert (48, -2) in c and (42, 9) in c  # Rennes, Corse
    assert (-21, 55) in c and (4, -53) in c and (-13, 45) in c  # Réunion, Guyane, Mayotte
    assert len(c) == len(set(c)) < 250


def test_points_tries_filtres_et_case_en_echec_gardee(tmp_path):
    def faux(texte):
        return None if "49,-2" in texte else ELEMENTS
    code = pe.main(["--sortie", str(tmp_path), "--case", "48,-2", "--pause", "0"], interroger=faux)
    assert code == 0
    d = json.loads((tmp_path / "eau_48_-2.json").read_text())
    assert "OpenStreetMap" in d["source"]
    pts = {(p[0], p[1]): p for p in d["points"]}
    assert len(pts) == 3  # pas d'eau non potable, pas d'accès privé, pas de doublon
    assert pts[(-168000, 4811000)][2:] == [0, "Fontaine du parc", "oui", "2025-06-01"]
    assert pts[(-150000, 4820000)][2] == 1 and pts[(-140000, 4830000)][2] == 2
    # serveurs injoignables : code d'échec, et aucun fichier écrasé
    assert pe.main(["--sortie", str(tmp_path), "--case", "49,-2", "--pause", "0"], interroger=faux) == 2
    assert not (tmp_path / "eau_49_-2.json").exists()


def test_reprise_cases_recentes_sautees(tmp_path):
    appels = []

    def faux(texte):
        appels.append(texte)
        return ELEMENTS
    assert pe.main(["--sortie", str(tmp_path), "--case", "48,-2", "--pause", "0"], interroger=faux) == 0
    assert pe.main(["--sortie", str(tmp_path), "--case", "48,-2", "--pause", "0", "--age-max", "20"], interroger=faux) == 0
    assert len(appels) == 1  # case à jour : pas de nouvelle requête


def test_case_trop_chargee_en_quatre_quarts(tmp_path):
    def faux(texte):
        return None if "48,-2,49,-1" in texte else ELEMENTS[:1]
    assert pe.main(["--sortie", str(tmp_path), "--case", "48,-2", "--pause", "0"], interroger=faux) == 0
    assert len(json.loads((tmp_path / "eau_48_-2.json").read_text())["points"]) == 1  # 4 quarts, doublons écartés
