import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import precalcul  # noqa: E402
from trailcotes.base import cotes_proches, ouvrir  # noqa: E402


def test_tuiles_couvrent_la_zone():
    t = list(precalcul.tuiles(48.0, -1.8, 48.1, -1.6, 4000))
    assert len(t) == 3 * 4  # 11 km × 15 km en tuiles de 4 km
    assert len({i for i, *_ in t}) == len(t)


def test_precalcul_reprise_et_recherche(tmp_path):
    base = tmp_path / "b.sqlite"
    zone = "48.10,-1.70,48.13,-1.65"
    args = ["--zone", zone, "--demo", "--base", str(base), "--tuile", "2000"]
    assert precalcul.main(args + ["--max-tuiles", "2"]) == 0
    con = ouvrir(base)
    assert con.execute("SELECT COUNT(*) FROM tuiles WHERE statut='ok'").fetchone()[0] == 2
    assert precalcul.main(args) == 0  # reprise : finit les tuiles restantes
    n_tuiles = len(list(precalcul.tuiles(48.10, -1.70, 48.13, -1.65, 2000)))
    assert con.execute("SELECT COUNT(*) FROM tuiles WHERE statut='ok'").fetchone()[0] == n_tuiles
    total = con.execute("SELECT COUNT(*) FROM cotes").fetchone()[0]
    assert total > 0
    assert precalcul.main(args) == 0  # relancer ne recalcule rien et n'ajoute pas de doublons
    assert con.execute("SELECT COUNT(*) FROM cotes").fetchone()[0] == total
    proches = cotes_proches(con, 48.115, -1.675, 5000)
    assert proches and proches == sorted(proches, key=lambda c: c["distance_m"])
    assert isinstance(proches[0]["pentes_50m"], list) and proches[0]["geometrie"]
    assert all(c["pente_moy_pct"] >= 7 for c in cotes_proches(con, 48.115, -1.675, 5000, pente_min=7))


def test_adresses_completees_une_fois(tmp_path):
    from trailcotes.adresses import completer_adresses

    base = tmp_path / "b.sqlite"
    assert precalcul.main(["--zone", "48.10,-1.70,48.11,-1.69", "--demo", "--base", str(base), "--tuile", "2000"]) == 0
    con = ouvrir(base)
    n = con.execute("SELECT COUNT(*) FROM cotes").fetchone()[0]
    appels = []

    def faux(lat, lon):
        appels.append((lat, lon))
        if len(appels) == 1:
            raise TimeoutError("réseau")
        return f"{len(appels)} Rue d'essai 35000 Rennes"

    assert completer_adresses(con, faux, pause=0) == (n - 1, 1)
    assert completer_adresses(con, faux, pause=0) == (1, 0)  # seule la côte en échec est reprise
    assert con.execute("SELECT COUNT(*) FROM cotes WHERE adresse LIKE '%Rue d''essai%'").fetchone()[0] == n


def test_reseau_app_demo(tmp_path):
    """Réseau pour les boucles : graphe connexe, D+ dans les deux sens, format compact."""
    import exporter_reseau as er
    sortie = tmp_path / "reseau.json"
    assert er.main(["--demo", "--sortie", str(sortie), "--rapport", str(tmp_path / "r.json")]) == 0
    r = json.loads(sortie.read_text())
    assert r["types"][0] == "route" and r["trafics"] == ["calme", "modéré", "passant"]
    n = len(r["noeuds"])
    assert n > 50 and len(r["aretes"]) > n
    for a, b, longueur, plus, moins, t, s, nom, inter in r["aretes"]:
        assert 0 <= a < n and 0 <= b < n and longueur > 0 and plus >= 0 and moins >= 0 and len(inter) % 2 == 0
    # le relief fictif a une colline : certaines arêtes montent
    assert max(a[3] for a in r["aretes"]) > 2


def test_douglas_peucker_et_denivele():
    import numpy as np
    import exporter_reseau as er
    xy = np.array([[0, 0], [10, 0.5], [20, 0], [30, 10], [40, 20]], float)
    assert er.douglas_peucker(xy, 1).tolist() == [0, 2, 4]
    assert er.denivele(np.array([0, 1, 0, 1, 5, 4.5, 2])) == (5.0, 3.0)
