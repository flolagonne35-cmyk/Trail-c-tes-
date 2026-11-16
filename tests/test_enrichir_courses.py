"""Notoriété (Wikidata) et prix des carburants : hors réseau, avec des réponses simulées."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import enrichir_courses as en  # noqa: E402


def test_nom_sans_edition_ni_annee():
    assert en.nom_recherche("12e Trail des Templiers 2026") == "Trail des Templiers"
    assert en.nom_recherche("Marathon de Paris - 49ème édition") == "Marathon de Paris"


def test_choix_de_l_element_wikidata():
    resultats = [
        {"id": "Q1", "label": "Templiers", "description": "ordre militaire"},
        {"id": "Q2", "label": "Grand Trail des Templiers", "description": "course de trail à Millau"},
    ]
    assert en.choisir_entite(resultats, "Grand Trail des Templiers") == "Q2"
    # même nom de ville, mais pas une course : refusé
    assert en.choisir_entite([{"id": "Q3", "label": "Foulées de Rennes", "description": "association"}], "Foulées de Rennes") is None


def test_notoriete_et_cache(tmp_path):
    appels = []

    def faux(url, params):
        appels.append(params["action"])
        if params["action"] == "wbsearchentities":
            if "Paris" in params["search"]:
                return {"search": [{"id": "Q1061517", "label": "Marathon de Paris", "description": "marathon annuel à Paris"}]}
            return {"search": []}
        return {"entities": {"Q1061517": {"sitelinks": {"frwiki": {}, "enwiki": {}, "dewiki": {}, "commonswiki": {}}}}}

    courses = [{"nom": "Marathon de Paris 2027"}, {"nom": "Foulées du bourg"}]
    cache = en.notoriete(courses, {}, faux, pause_s=0)
    assert courses[0]["connue"] == 3 and courses[0]["wikidata"] == "Q1061517"
    assert "connue" not in courses[1]
    assert cache["Foulées du bourg"] is None
    # le lendemain : rien n'est recherché à nouveau
    appels.clear()
    en.notoriete([{"nom": "Marathon de Paris 2027"}], cache, faux, pause_s=0)
    assert appels == []


def test_prix_carburants_et_repli():
    ok = en.prix_carburants(lambda u, p: {"results": [{"gazole": 1.6123, "e10": 1.7, "sp95": 1.75}]})
    assert ok["gazole"] == 1.612 and "moyenne" in ok["source"]
    assert en.prix_carburants(lambda u, p: None)["source"] == "valeurs de repli"


def test_enrichir_ecrit_cache_et_carburants(tmp_path):
    def faux(url, params):
        return {"search": []} if params.get("action") else {"results": [{"gazole": 1.6, "e10": 1.7, "sp95": 1.8}]}
    r = en.enrichir([{"nom": "Trail du coin"}], tmp_path, tmp_path / "carburants.json", faux)
    assert r["connues"] == 0
    assert json.loads((tmp_path / "carburants.json").read_text())["gazole"] == 1.6
    assert (tmp_path / "wikidata_cache.json").exists()
