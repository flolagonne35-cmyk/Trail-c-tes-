"""Côtes au profil impossible écartées à l'export (cas réel du 25/11 : Arzal, « 170 m à 33 122 % »)."""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import exporter_departement as ex  # noqa: E402
from trailcotes import ign  # noqa: E402


def test_export_ecarte_les_cotes_impossibles():
    ok = {"pente_moy_pct": 8.5, "pente_max_pct": 14, "dplus_m": 34, "longueur_m": 400, "profil": {"z": [12, 46]}}
    assert ex.plausible(ok)
    assert not ex.plausible({"pente_moy_pct": 33122.5, "pente_max_pct": 55384, "dplus_m": 56308, "longueur_m": 170,
                             "profil": {"z": [-56302.4, 5.8]}})
    assert not ex.plausible({**ok, "profil": {"z": [-800, 46]}})


def test_altitudes_impossibles_traitees_comme_manquantes():
    assert ign.ALTITUDE_MIN_PLAUSIBLE == -500.0
    z = np.array([12.0, -99999.0, -3400.0, 8.0])
    manquant = (z <= ign.NODATA_IGN + 1) | (z < ign.ALTITUDE_MIN_PLAUSIBLE)
    assert manquant.tolist() == [False, True, True, False]
