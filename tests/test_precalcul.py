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


def test_export_app_plusieurs_zones(tmp_path):
    """Deux bases (deux zones) → un seul cotes.json, ids uniques, une zone décrite par base."""
    import exporter_app
    bases = []
    for nom, zone in (("rennes", "48.10,-1.70,48.12,-1.67"), ("nantes", "47.20,-1.58,47.22,-1.55")):
        base = tmp_path / f"{nom}.sqlite"
        assert precalcul.main(["--zone", zone, "--demo", "--base", str(base), "--tuile", "2000", "--sans-adresses"]) == 0
        bases.append(str(base))
    assert exporter_app.main(["--base", *bases, "--sortie", str(tmp_path / "app")]) == 0
    d = json.loads((tmp_path / "app" / "cotes.json").read_text())
    assert [z["nom"] for z in d["zones"]] == ["Nantes Métropole", "Rennes Métropole"]
    ids = [c["id"] for c in d["cotes"]]
    assert len(ids) == len(set(ids)) == sum(z["cotes"] for z in d["zones"])
    assert all(len(c["geometrie"]) <= 50 and len(c["profil"]["d"]) <= 80 for c in d["cotes"])


def test_reseau_plusieurs_zones(tmp_path):
    import exporter_reseau as er
    un, deux = tmp_path / "1.json", tmp_path / "2.json"
    assert er.main(["--demo", "--sortie", str(un), "--rapport", str(tmp_path / "r1.json")]) == 0
    assert er.main(["--demo", "--zone", "48.07,-1.75,48.10,-1.70", "--zone", "47.20,-1.60,47.23,-1.55",
                    "--sortie", str(deux), "--rapport", str(tmp_path / "r2.json")]) == 0
    a, b = json.loads(un.read_text()), json.loads(deux.read_text())
    assert len(b["zones"]) == 2 and len(b["noeuds"]) == 2 * len(a["noeuds"])
    n = len(b["noeuds"])
    assert all(0 <= x[0] < n and 0 <= x[1] < n for x in b["aretes"])
    # la seconde zone garde des numéros de nœuds décalés
    assert max(x[0] for x in b["aretes"][len(a["aretes"]):]) >= len(a["noeuds"])


def test_reseau_par_zone_et_index(tmp_path):
    """Un fichier par zone, et l'index de l'appli avec l'emprise et un require par fichier."""
    import exporter_reseau as er
    import index_reseaux as ir
    sortie = tmp_path / "rennes.reseau"
    assert er.main(["--demo", "--nom", "rennes", "--zone", "48.10,-1.70,48.12,-1.66",
                    "--sortie", str(sortie), "--rapport", str(tmp_path / "r.json")]) == 0
    r = json.loads(sortie.read_text())
    assert r["nom"] == "rennes" and r["zones"] == [[48.10, -1.70, 48.12, -1.66]]
    ts = ir.index(tmp_path)
    assert 'nom: "rennes", libelle: "Rennes Métropole", emprise: [48.1, -1.7, 48.12, -1.66]' in ts
    assert 'require("../../assets/data/reseau/rennes.reseau")' in ts


def test_grille_france_par_departement(tmp_path):
    """Grille France : chaque tuile appartient à un seul département, pas de tuile en pleine mer."""
    import precalcul as pc
    # trois communes fictives : deux en « 35 », une en « 44 », à 30 km l'une de l'autre
    communes = [["A", "35000", "35", 48.11, -1.68, 1], ["B", "35500", "35", 48.12, -1.20, 1],
                ["C", "44000", "44", 47.85, -1.55, 1]]
    t35 = list(pc.tuiles_departement("35", 4000, communes))
    t44 = list(pc.tuiles_departement("44", 4000, communes))
    assert t35 and t44 and not ({t[0] for t in t35} & {t[0] for t in t44})
    # aucune tuile à plus de 8 km de toute commune
    for _, lat, lon, *_ in t35 + t44:
        assert min(((lat - c[3]) * 111.2) ** 2 + ((lon - c[4]) * 74) ** 2 for c in communes) <= 8.5 ** 2


def test_export_departement_identifiants_uniques(tmp_path):
    import precalcul as pc
    import exporter_departement as ed
    base = tmp_path / "dep_35.sqlite"
    assert pc.main(["--zone", "48.10,-1.70,48.12,-1.66", "--demo", "--base", str(base), "--max-tuiles", "1"]) in (0, 2)
    r = ed.exporter("35", base, tmp_path / "sortie")
    donnees = json.loads((tmp_path / "sortie" / "cotes_35.json").read_text())
    assert r["nombre"] == donnees["nombre"] == len(donnees["cotes"]) > 0
    assert all(35_000_000 < c["id"] < 36_000_000 for c in donnees["cotes"])
    assert ed.numero("2A") == 200 and ed.numero("974") == 974
    assert r["fichiers"] == ["cotes_35.json"] and len(donnees["cotes"][0]["geometrie"]) <= 30


def test_tuile_sans_voie_terminee_mais_erreur_wfs_reprise(tmp_path, monkeypatch):
    """Mer, forêt, Guyane : aucune voie et WFS sans erreur → « vide », terminée. Erreur WFS → reprise."""
    import types
    erreurs: list = []

    def calculer(params):
        return types.SimpleNamespace(troncons=[], cotes=[], taux_valide=0.0, nb_points=0,
                                     wfs=types.SimpleNamespace(erreurs=list(erreurs), codes_http={}),
                                     alti=types.SimpleNamespace(codes_http={}), osm=types.SimpleNamespace(statut=""))
    monkeypatch.setattr(precalcul.cotes_bdtopo, "calculer", calculer)
    base = tmp_path / "b.sqlite"
    args = ["--zone", "48.10,-1.70,48.13,-1.65", "--base", str(base), "--tuile", "2000", "--sans-adresses"]
    n = len(list(precalcul.tuiles(48.10, -1.70, 48.13, -1.65, 2000)))
    erreurs.append("HTTP 503")
    assert precalcul.main(args) == 2  # service en panne : tuiles en échec, reprises plus tard
    con = ouvrir(base)
    assert con.execute("SELECT COUNT(*) FROM tuiles WHERE statut='echec'").fetchone()[0] == n
    erreurs.clear()
    assert precalcul.main(args) == 0  # le service répond : tuiles vides, terminées
    assert con.execute("SELECT COUNT(*) FROM tuiles WHERE statut='vide'").fetchone()[0] == n
    rapport = json.loads((tmp_path / "rapport_b.json").read_text())
    assert rapport["resume"]["Tuiles"] == f"{n} faites / {n} (0 restantes)"


def test_tuile_en_bord_de_couverture_ign(tmp_path, monkeypatch):
    """Points sans altitude alors que tous les lots ont répondu (frontière, mer) : tuile terminée.
    Lots d'altitude en échec : tuile reprise au passage suivant."""
    import types
    lots_en_echec = [1]

    def calculer(params):
        return types.SimpleNamespace(troncons=[1], cotes=[], taux_valide=0.6, nb_points=100,
                                     wfs=types.SimpleNamespace(erreurs=[], codes_http={}),
                                     alti=types.SimpleNamespace(codes_http={}, lots_en_echec=lots_en_echec[0]),
                                     osm=types.SimpleNamespace(statut=""))
    monkeypatch.setattr(precalcul.cotes_bdtopo, "calculer", calculer)
    base = tmp_path / "b.sqlite"
    args = ["--zone", "48.10,-1.70,48.13,-1.65", "--base", str(base), "--tuile", "2000", "--sans-adresses"]
    assert precalcul.main(args) == 2
    lots_en_echec[0] = 0
    assert precalcul.main(args) == 0
    con = ouvrir(base)
    assert con.execute("SELECT COUNT(*) FROM tuiles WHERE statut != 'ok'").fetchone()[0] == 0


def test_reseau_france_tuiles_raccordees_et_blocs(tmp_path):
    """Réseau France : chaque tronçon dans une seule tuile (son milieu), extrémités en coordonnées
    entières qui raccordent les tuiles, reprise, export par blocs et index de l'appli."""
    import reseau_france as rf
    import index_reseau_france as irf
    base = tmp_path / "r.sqlite"
    args = ["--zone", "48.10,-1.70,48.13,-1.65", "--demo", "--base", str(base)]
    assert rf.main(args) == 0
    con = rf.ouvrir(base)
    n_tuiles, n_ok = con.execute("SELECT COUNT(*), SUM(statut = 'ok') FROM tuiles").fetchone()
    assert n_tuiles > 1 and n_ok >= 1
    assert rf.main(args) == 0  # reprise : rien à recalculer
    assert con.execute("SELECT COUNT(*) FROM tuiles").fetchone()[0] == n_tuiles
    toutes = [a for (x,) in con.execute("SELECT aretes FROM tuiles WHERE statut='ok'") for a in json.loads(x)]
    cles = [tuple(a[:4]) + (a[4],) for a in toutes]
    assert len(cles) == len(set(cles))  # pas de tronçon en double entre tuiles voisines
    sortie = tmp_path / "dist"
    assert rf.main(["--base", str(base), "--exporter", str(sortie)]) == 0
    assert irf.main([str(sortie)]) == 0
    idx = json.loads((sortie / "index.json").read_text())
    assert idx["blocs"] and all(len(b["e"]) == 4 and b["n"] > 0 for b in idx["blocs"])
    bloc = json.loads((sortie / idx["blocs"][0]["f"]).read_text())
    n = len(bloc["noeuds"])
    assert all(0 <= a[0] < n and 0 <= a[1] < n and len(a[8]) % 2 == 0 for a in bloc["aretes"])
    assert sum(len(json.loads((sortie / b["f"]).read_text())["aretes"]) for b in idx["blocs"]) == len(toutes)
