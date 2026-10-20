import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import cotes_bdtopo as cb  # noqa: E402


def troncon(xy, nature="Chemin", ouvrage=False, ident="t"):
    xy = np.asarray(xy, dtype=float)
    return cb.Troncon(ident, nature, cb.TYPE_VOIE[nature], "", ouvrage, xy,
                      float(cb.longueurs_cumulees(xy)[-1]))


def profil_test():
    """300 m plat, 500 m à 10 %, 300 m plat, 400 m à −8 %, 200 m plat."""
    d = np.arange(0, 1701, 10.0)
    z = np.interp(d, [0, 300, 800, 1100, 1500, 1700], [50, 50, 100, 100, 68, 68])
    return d, z


def test_extrema_et_decoupage():
    d, z = profil_test()
    pts = cb.extrema(z, 3)
    assert len(pts) == 3  # creux, sommet, creux
    montee = cb.decouper_montee(d[pts[0]:pts[1] + 1] - d[pts[0]], z[pts[0]:pts[1] + 1], 2.5, 1.5, 150, 50)
    assert len(montee) == 1
    i, k = montee[0]
    dd = d[pts[0]:pts[1] + 1] - d[pts[0]]
    assert abs((dd[k] - dd[i]) - 500) <= 20


def test_cotes_dans_les_deux_sens():
    d, z = profil_test()
    t = troncon([[0, 0], [1700, 0]])
    voie = cb.Voie([(0, False)], d, d.copy(), np.zeros_like(d), np.zeros(len(d), int), d.copy(),
                   np.zeros(len(d), bool), z)
    reseau = cb.Reseau([t])
    reseau.accrocher(0, 0)
    args = cb.parser_arguments([])
    cotes = cb.cotes_de_voie(voie, [t], cb.Projection(48, -1.7), reseau, args)
    assert len(cotes) == 2
    a, b = sorted(cotes, key=lambda c: c.distance_m)
    assert abs(a.longueur_m - 500) <= 20 and abs(a.pente_moy_pct - 10) < 0.6
    assert abs(b.longueur_m - 400) <= 20 and abs(b.pente_moy_pct - 8) < 0.6
    assert abs(b.distance_m - 1500) <= 20  # la descente se monte depuis le km 1,5
    assert all(abs(p - 10) < 1 for p in a.pentes_50m[1:-1])


def test_replat_coupe_la_cote():
    d = np.arange(0, 1001, 10.0)
    z = np.interp(d, [0, 300, 600, 900, 1000], [0, 30, 30, 60, 60])  # 2 rampes séparées par 300 m de plat
    pts = cb.extrema(z, 3)
    morceaux = cb.decouper_montee(d, z, 2.5, 1.5, 150, 50)
    assert pts == [0, 90] and len(morceaux) == 2


def test_chainage_ligne_droite_et_virage():
    ts = [troncon([[0, 0], [100, 0]], ident="a"),
          troncon([[100, 0], [200, 0]], ident="b"),
          troncon([[100, 0], [100, 100]], ident="c"),           # perpendiculaire : pas raccordé
          troncon([[200, 0], [300, 0]], "Route à 1 chaussée", ident="d")]  # autre type : pas raccordé
    chaines = sorted(cb.chainer(ts), key=len, reverse=True)
    assert len(chaines) == 3
    assert sorted(i for i, _ in chaines[0]) == [0, 1]


def test_accrochage_et_distance_reseau():
    ts = [troncon([[0, 0], [100, 0]]), troncon([[100, 0], [100, 100]]), troncon([[100, 100], [200, 100]])]
    r = cb.Reseau(ts)
    acc = r.accrocher(20, 5)
    assert abs(acc["distance_m"] - 5) < 1e-6
    assert abs(r.distance(2, 50) - (80 + 100 + 50)) < 1e-6


def test_axes_inverses():
    f = [{"geometry": {"type": "LineString", "coordinates": [[48.11, -1.68], [48.12, -1.67]]}}]
    assert cb.axes_inverses(f, 48.11, -1.68)
    f[0]["geometry"]["coordinates"] = [[-1.68, 48.11], [-1.67, 48.12]]
    assert not cb.axes_inverses(f, 48.11, -1.68)


def test_ouvrage_et_natures_exclues():
    proj = cb.Projection(48.11, -1.68)
    feats = [
        {"geometry": {"type": "LineString", "coordinates": [[-1.68, 48.11], [-1.679, 48.11]]},
         "properties": {"nature": "Sentier", "position_par_rapport_au_sol": "1"}},
        {"geometry": {"type": "LineString", "coordinates": [[-1.68, 48.11], [-1.679, 48.11]]},
         "properties": {"nature": "Type autoroutier"}},
    ]
    ts = cb.lire_troncons(feats, proj, False, cb.StatsWfs())
    assert len(ts) == 1 and ts[0].ouvrage and ts[0].type_voie == "sentier"


def test_demo_bout_en_bout(tmp_path):
    code = cb.analyser(cb.parser_arguments(["--demo", "--sortie", str(tmp_path)]))
    assert code == 0
    for nom in ("cotes.csv", "cotes.geojson", "carte.png", "rapport.json"):
        assert (tmp_path / nom).stat().st_size > 0
    assert len((tmp_path / "cotes.csv").read_text().splitlines()) > 1
