import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import cotes_bdtopo as cb  # noqa: E402
from trailcotes import bdtopo, geo, osm, profil  # noqa: E402


def troncon(xy, nature="Chemin", ouvrage=False, ident="t"):
    xy = np.asarray(xy, dtype=float)
    return bdtopo.Troncon(ident, nature, bdtopo.TYPE_VOIE[nature], "", ouvrage, xy,
                      float(geo.longueurs_cumulees(xy)[-1]))


def profil_test():
    """300 m plat, 500 m à 10 %, 300 m plat, 400 m à −8 %, 200 m plat."""
    d = np.arange(0, 1701, 10.0)
    z = np.interp(d, [0, 300, 800, 1100, 1500, 1700], [50, 50, 100, 100, 68, 68])
    return d, z


def test_extrema_et_decoupage():
    d, z = profil_test()
    pts = profil.extrema(z, 3)
    assert len(pts) == 3  # creux, sommet, creux
    montee = profil.decouper_montee(d[pts[0]:pts[1] + 1] - d[pts[0]], z[pts[0]:pts[1] + 1], 2.5, 1.5, 150, 50)
    assert len(montee) == 1
    i, k = montee[0]
    dd = d[pts[0]:pts[1] + 1] - d[pts[0]]
    assert abs((dd[k] - dd[i]) - 500) <= 20


def test_cotes_dans_les_deux_sens():
    d, z = profil_test()
    t = troncon([[0, 0], [1700, 0]])
    voie = bdtopo.Voie([(0, False)], d, d.copy(), np.zeros_like(d), np.zeros(len(d), int), d.copy(),
                   np.zeros(len(d), bool), z)
    reseau = bdtopo.Reseau([t])
    reseau.accrocher(0, 0)
    args = cb.parser_arguments([])
    cotes = cb.cotes_de_voie(voie, [t], geo.Projection(48, -1.7), reseau, args)
    assert len(cotes) == 2
    a, b = sorted(cotes, key=lambda c: c.distance_m)
    assert abs(a.longueur_m - 500) <= 20 and abs(a.pente_moy_pct - 10) < 0.6
    assert abs(b.longueur_m - 400) <= 20 and abs(b.pente_moy_pct - 8) < 0.6
    assert abs(b.distance_m - 1500) <= 20  # la descente se monte depuis le km 1,5
    assert all(abs(p - 10) < 1 for p in a.pentes_50m[1:-1])


def test_replat_coupe_la_cote():
    d = np.arange(0, 1001, 10.0)
    z = np.interp(d, [0, 300, 600, 900, 1000], [0, 30, 30, 60, 60])  # 2 rampes séparées par 300 m de plat
    pts = profil.extrema(z, 3)
    morceaux = profil.decouper_montee(d, z, 2.5, 1.5, 150, 50)
    assert pts == [0, 90] and len(morceaux) == 2


def test_chainage_ligne_droite_et_virage():
    ts = [troncon([[0, 0], [100, 0]], ident="a"),
          troncon([[100, 0], [200, 0]], ident="b"),
          troncon([[100, 0], [100, 100]], ident="c"),           # perpendiculaire : pas raccordé
          troncon([[200, 0], [300, 0]], "Route à 1 chaussée", ident="d")]  # autre type : pas raccordé
    chaines = sorted(bdtopo.chainer(ts), key=len, reverse=True)
    assert len(chaines) == 3
    assert sorted(i for i, _ in chaines[0]) == [0, 1]


def test_accrochage_et_distance_reseau():
    ts = [troncon([[0, 0], [100, 0]]), troncon([[100, 0], [100, 100]]), troncon([[100, 100], [200, 100]])]
    r = bdtopo.Reseau(ts)
    acc = r.accrocher(20, 5)
    assert abs(acc["distance_m"] - 5) < 1e-6
    assert abs(r.distance(2, 50) - (80 + 100 + 50)) < 1e-6


def test_axes_inverses():
    f = [{"geometry": {"type": "LineString", "coordinates": [[48.11, -1.68], [48.12, -1.67]]}}]
    assert bdtopo.axes_inverses(f, 48.11, -1.68)
    f[0]["geometry"]["coordinates"] = [[-1.68, 48.11], [-1.67, 48.12]]
    assert not bdtopo.axes_inverses(f, 48.11, -1.68)


def test_ouvrage_et_natures_exclues():
    proj = geo.Projection(48.11, -1.68)
    feats = [
        {"geometry": {"type": "LineString", "coordinates": [[-1.68, 48.11], [-1.679, 48.11]]},
         "properties": {"nature": "Sentier", "position_par_rapport_au_sol": "1"}},
        {"geometry": {"type": "LineString", "coordinates": [[-1.68, 48.11], [-1.679, 48.11]]},
         "properties": {"nature": "Type autoroutier"}},
    ]
    ts = bdtopo.lire_troncons(feats, proj, False, bdtopo.StatsWfs())
    assert len(ts) == 1 and ts[0].ouvrage and ts[0].type_voie == "sentier"


def test_demo_bout_en_bout(tmp_path):
    code = cb.analyser(cb.parser_arguments(["--demo", "--sortie", str(tmp_path)]))
    assert code == 0
    for nom in ("cotes.csv", "cotes.geojson", "carte.png", "rapport.json"):
        assert (tmp_path / nom).stat().st_size > 0
    assert len((tmp_path / "cotes.csv").read_text().splitlines()) > 1


def test_acces_pieton():
    assert bdtopo.acces_pieton_ok({"prive": False, "acces_pieton": None, "sens_de_circulation": "Sens direct"})
    assert not bdtopo.acces_pieton_ok({"prive": True})
    assert not bdtopo.acces_pieton_ok({"acces_pieton": "Restreint aux ayants droit"})
    assert not bdtopo.acces_pieton_ok({"acces_pieton": "Interdit"})


def test_nom_complet_prefere():
    proj = geo.Projection(48.11, -1.68)
    f = {"geometry": {"type": "LineString", "coordinates": [[-1.68, 48.11], [-1.679, 48.11]]},
         "properties": {"nature": "Route à 1 chaussée", "nom_1_gauche": "R GAMBETTA",
                        "nom_collaboratif_gauche": "Rue Gambetta"}}
    assert bdtopo.lire_troncons([f], proj, False, bdtopo.StatsWfs())[0].nom == "Rue Gambetta"


def _cote(lonlat, type_voie="chemin"):
    c = cb.Cote(1, 0, 100, 8, 9, 8, 0, 8, type_voie, "Chemin", "", 0, 0, 0, 0, [8.0])
    c.lonlat = lonlat
    return c


def test_revetement_osm_et_repli():
    proj = geo.Projection(48.11, -1.68)
    trace = [[-1.68 + i * 1e-4, 48.11] for i in range(15)]  # ~110 m vers l'est
    voisine = [{"lon": lon, "lat": lat + 5e-5} for lon, lat in trace]  # à ~5 m
    lointaine = [{"lon": lon, "lat": lat + 1e-3} for lon, lat in trace]  # à ~110 m
    voies = [{"tags": {"surface": "fine_gravel", "smoothness": "bad", "name": "Rue Gambetta"}, "geometry": voisine},
             {"tags": {"surface": "asphalt"}, "geometry": lointaine}]
    a, b, c = _cote(trace), _cote([[lon, lat + 1e-3] for lon, lat in trace]), _cote(
        [[lon, lat - 5e-3] for lon, lat in trace], "route")
    osm.qualifier_revetement([a, b, c], voies, proj)
    assert (a.revetement, a.technicite, a.couverture_osm_pct) == ("stabilisé", "technique", 100)
    assert a.nom == "Rue Gambetta"
    assert b.revetement == "goudronné" and b.source_revetement == "OSM surface"
    assert c.revetement == "goudronné (supposé)" and c.source_revetement == "nature BD TOPO"
    voies[0]["tags"] = {"tracktype": "grade3"}
    osm.qualifier_revetement([a], voies, proj)
    assert a.revetement == "terre" and a.source_revetement == "OSM tracktype"


def test_plus_court_chemin():
    # carré de 100 m avec une diagonale ; de (10, 0) à (100, 90) le plus court passe par la diagonale ?
    ts = [troncon([[0, 0], [100, 0]]), troncon([[100, 0], [100, 100]]),
          troncon([[0, 0], [0, 100]]), troncon([[0, 100], [100, 100]])]
    r = bdtopo.Reseau(ts)
    xy = r.chemin((10, 0), (100, 90))
    assert np.allclose(xy[0], [10, 0]) and np.allclose(xy[-1], [100, 90])
    assert abs(geo.longueurs_cumulees(xy)[-1] - 180) < 1e-6  # 90 m + 90 m par le coin (100, 0)
    xy = r.chemin((20, 0), (60, 0))  # même tronçon
    assert abs(geo.longueurs_cumulees(xy)[-1] - 40) < 1e-6
