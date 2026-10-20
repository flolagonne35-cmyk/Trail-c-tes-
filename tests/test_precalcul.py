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
