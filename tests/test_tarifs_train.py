"""Tests hors réseau du prix du train (scripts/tarifs_train.py)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import tarifs_train as tt  # noqa: E402

GARES = [
    {"nom": "Rennes", "codes_uic": "87471003", "position_geographique": {"lat": 48.1035, "lon": -1.6722}},
    {"nom": "Laval", "codes_uic": "87478404", "position_geographique": {"lat": 48.0763, "lon": -0.7614}},
    {"nom": "Bordeaux Saint-Jean", "codes_uic": "87581009", "position_geographique": {"lat": 44.8259, "lon": -0.5562}},
]
TGV = [
    {"transporteur": "OUIGO TRAIN CLASSIQUE", "gare_origine": "LAVAL", "gare_origine_code_uic": "87478404",
     "gare_destination": "RENNES", "gare_destination_code_uic": "87471003", "classe": "2", "profil_tarifaire": "Tarif Normal",
     "prix_minimum": 10.0, "prix_maximum": 59.0},
    {"transporteur": "TGV INOUI", "gare_origine": "RENNES", "gare_origine_code_uic": "87471003",
     "gare_destination": "LAVAL", "gare_destination_code_uic": "87478404", "classe": "2", "profil_tarifaire": "Tarif Normal",
     "prix_minimum": 15.0, "prix_maximum": 35.0},
    # 1re classe et carte Avantage : ignorées
    {"transporteur": "TGV INOUI", "gare_origine": "RENNES", "gare_origine_code_uic": "87471003",
     "gare_destination": "LAVAL", "gare_destination_code_uic": "87478404", "classe": "1", "profil_tarifaire": "Tarif Normal",
     "prix_minimum": 30.0, "prix_maximum": 90.0},
    {"transporteur": "TGV INOUI", "gare_origine": "RENNES", "gare_origine_code_uic": "87471003",
     "gare_destination": "LAVAL", "gare_destination_code_uic": "87478404", "classe": "2", "profil_tarifaire": "Tarif Avantage",
     "prix_minimum": 5.0, "prix_maximum": 20.0},
]
IC = [
    {"transporteur": "Intercités de jour à réservation obligatoire", "origine": "BORDEAUX ST JEAN", "origine_uic8": "87581009",
     "destination": "RENNES", "destination_uic8": "87471003", "classe": "2", "profil_tarifaire": "Tarif Normal",
     "type_place": "assise", "prix_min": 25.0, "prix_max": 70.0},
    {"transporteur": "Intercités de nuit", "origine": "INCONNUE", "origine_uic8": "87000000",
     "destination": "RENNES", "destination_uic8": "87471003", "classe": "2", "profil_tarifaire": "Tarif Normal",
     "type_place": "assise", "prix_min": 20.0, "prix_max": 40.0},
]


def test_fusion_des_sens_et_des_transporteurs():
    r = tt.compiler(TGV, IC, GARES)
    noms = [g[1] for g in r["gares"]]
    assert set(noms) == {"Rennes", "Laval", "Bordeaux Saint-Jean"}
    paires = {(noms[a], noms[b]): (pmin, pmax, t) for a, b, pmin, pmax, t in r["trajets"]}
    laval_rennes = paires.get(("Rennes", "Laval")) or paires[("Laval", "Rennes")]
    # Rennes-Laval dans les deux sens : 10 € (OUIGO) à 59 € ; TGV INOUI et OUIGO ; pas la 1re ni la carte Avantage
    assert laval_rennes == (10.0, 59.0, tt.TYPES["TGV INOUI"] | tt.TYPES["OUIGO"])
    bdx = paires.get(("Rennes", "Bordeaux Saint-Jean")) or paires[("Bordeaux Saint-Jean", "Rennes")]
    assert bdx == (25.0, 70.0, tt.TYPES["INTERCITES"])
    assert r["sans_position"] == ["INCONNUE"]


def test_type_de_transporteur():
    assert tt.type_de("OUIGO TRAIN CLASSIQUE") == 2
    assert tt.type_de("Intercités de jour") == 4
    assert tt.type_de("TGV INOUI") == 1
