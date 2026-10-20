import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import plan_nutrition as pn  # noqa: E402
import segmenter_gpx as sg  # noqa: E402
from trailcotes.geo import Projection  # noqa: E402
from trailcotes.gpx import ecrire_gpx, lire_gpx  # noqa: E402


def gpx_test(chemin):
    """1 km plat, 2 km à 8 %, 1 km plat, 1,5 km à −10 %, avec un peu de bruit GPS."""
    d = np.arange(0, 5501, 5.0)
    z = np.interp(d, [0, 1000, 3000, 4000, 5500], [100, 100, 260, 260, 110])
    z = z + np.random.default_rng(1).normal(0, 0.8, len(d))
    proj = Projection(45.0, 6.0)
    lon, lat = proj.lonlat(d, np.zeros_like(d))
    ecrire_gpx(chemin, "Test", lat, lon, z)


def test_gpx_aller_retour(tmp_path):
    gpx_test(tmp_path / "t.gpx")
    nom, lat, lon, ele = lire_gpx(tmp_path / "t.gpx")
    assert nom == "Test" and len(lat) == 1101 and np.isfinite(ele).all()


def test_segmentation(tmp_path):
    gpx_test(tmp_path / "t.gpx")
    code = sg.analyser(sg.parser_arguments([str(tmp_path / "t.gpx"), "--altitudes", "gpx",
                                            "--sortie", str(tmp_path)]))
    assert code == 0
    p = json.loads((tmp_path / "parcours.json").read_text())
    types = [s["type"] for s in p["segments"]]
    assert types == ["plat", "montée", "plat", "descente", "plat"][:len(types)] or types[:4] == [
        "plat", "montée", "plat", "descente"]
    montee = p["segments"][1]
    assert abs(montee["distance_km"] - 2.0) < 0.25 and abs(montee["pente_moy_pct"] - 8) < 1
    assert montee["difficulte"] in ("modérée", "difficile")  # 7,7 à 8 % : à la frontière
    descente = p["segments"][3]
    assert abs(descente["pente_moy_pct"] + 10) < 1.5
    assert abs(p["dplus_m"] - 160) < 25 and abs(p["distance_km"] - 5.5) < 0.05


def test_minetti_et_objectif():
    assert abs(pn.cout_minetti(np.array([0.0]))[0] - 3.6) < 1e-9
    assert 1.6 < pn.cout_minetti(np.array([0.1]))[0] / 3.6 < 1.75
    assert 0.55 < pn.cout_minetti(np.array([-0.1]))[0] / 3.6 < 0.65
    assert pn.lire_objectif("38h") == 38 and abs(pn.lire_objectif("5h40") - 5.6667) < 1e-3
    assert pn.lire_objectif("90min") == 1.5 and pn.lire_objectif("2,5") == 2.5


def test_plan_nutrition(tmp_path):
    gpx_test(tmp_path / "t.gpx")
    sg.analyser(sg.parser_arguments([str(tmp_path / "t.gpx"), "--altitudes", "gpx", "--sortie", str(tmp_path)]))
    assert pn.main([str(tmp_path / "parcours.json"), "--objectif", "1h", "--ravito", "3:Col",
                    "--temperature", "25"]) == 0
    plan = json.loads((tmp_path / "plan.json").read_text())["troncons"]
    assert [t["a"] for t in plan] == ["Col", "Arrivée"]
    assert abs(plan[-1]["passage_h"] - 1.0) < 1e-6
    # la montée (km 1 à 3) coûte plus cher que la descente : le 1er tronçon dure plus longtemps
    assert plan[0]["duree_h"] > plan[1]["duree_h"]
    # 25 °C : eau +20 %
    assert abs(plan[0]["eau_ml"] - 500 * 1.2 * plan[0]["duree_h"]) < 2
    assert (tmp_path / "plan.md").read_text().count("|") > 10
