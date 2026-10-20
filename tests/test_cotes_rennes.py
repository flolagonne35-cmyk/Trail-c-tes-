import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import cotes_rennes as cr  # noqa: E402
from trailcotes import ign  # noqa: E402


def test_pente_plan_incline():
    grille = cr.construire_grille(48.0, -1.7, rayon=200, pas=10)
    xx, _ = np.meshgrid(grille.x, grille.y)
    z = 0.08 * xx  # 8 % vers l'est
    assert np.allclose(cr.pente_pct(z, grille.pas), 8.0)


def test_lissage_ignore_les_nan():
    z = np.full((21, 21), 50.0)
    z[10, 10] = np.nan
    out = cr.lisser(z, sigma_m=20, pas=10)
    assert np.isnan(out[10, 10])
    assert np.allclose(out[np.isfinite(out)], 50.0)


def test_parser_formats_api():
    stats = ign.StatsApi()
    objets = {"elevations": [{"lon": -1.68, "lat": 48.11, "z": 42.5, "acc": "1 m"},
                             {"lon": -1.67, "lat": 48.12, "z": -99999, "acc": "-"}]}
    assert ign._parser_reponse(objets, 2, stats) == [42.5, -99999.0]
    assert stats.precisions == {"1 m": 1, "-": 1}
    assert ign._parser_reponse({"elevations": [10, 11]}, 2, stats) == [10.0, 11.0]
    with pytest.raises(ValueError):
        ign._parser_reponse({"elevations": [10]}, 2, stats)
    with pytest.raises(ValueError):
        ign._parser_reponse({"error": "boom"}, 2, stats)


def test_demo_bout_en_bout(tmp_path):
    code = cr.analyser(cr.parser_arguments(["--demo", "--sortie", str(tmp_path)]))
    assert code == 0
    for nom in ("grille.csv", "zones.csv", "carte.png", "rapport.json"):
        assert (tmp_path / nom).stat().st_size > 0
    assert len((tmp_path / "zones.csv").read_text().splitlines()) > 1


def test_repli_get_si_le_post_echoue(monkeypatch):
    """Un lot POST JSON en erreur 500 est refait en GET par lots de 150 points."""
    import requests

    class Reponse:
        def __init__(self, code, n=0):
            self.status_code, self.n, self.text = code, n, "erreur"

        def json(self):
            return {"elevations": [{"z": 42.0, "acc": "x"}] * self.n}

    appels = []

    class Session:
        headers: dict = {}

        def post(self, url, json=None, data=None, timeout=None):
            appels.append("POST")
            return Reponse(500)

        def get(self, url, params=None, timeout=None):
            appels.append("GET")
            return Reponse(200, len(params["lat"].split("|")))

    monkeypatch.setattr(requests, "Session", Session)
    monkeypatch.setattr(ign.time, "sleep", lambda s: None)
    stats = ign.StatsApi()
    lat = np.linspace(48, 48.1, 400)
    z = ign.altitudes_ign(lat, lat * 0 - 1.68, "r", 5000, 0, 2, stats, "POST_JSON")
    assert np.allclose(z, 42.0)
    assert appels == ["POST", "POST", "GET", "GET", "GET"] and stats.replis_get == 1
