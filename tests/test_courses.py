"""Import du calendrier des courses (DATAtourisme, OpenAgenda), sans réseau."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import courses_ouvertes as co  # noqa: E402

SPORT = "https://www.datatourisme.fr/ontology/core#SportsEvent|http://schema.org/SportsEvent"


def ligne(nom, periodes="2027-03-20<->2027-03-20", description="", categories=SPORT, **k):
    return {"Nom_du_POI": nom, "Categories_de_POI": categories, "Latitude": "49.1564", "Longitude": "5.3783",
            "Code_postal_et_commune": "55100#Verdun", "Periodes_regroupees": periodes, "Description": description,
            "Contacts_du_POI": "#http://www.traildestranchees.com/", "Createur_de_la_donnee": "OT Grand Verdun",
            "Date_de_mise_a_jour": "2026-10-06", "URI_ID_du_POI": "https://data.datatourisme.fr/10/abc", **k}


def test_datatourisme_courses_retenues_et_ecartees():
    auj = date(2026, 10, 21)
    lignes = [
        ligne("Trail des tranchées", description="4 parcours de 14 km, 18 km, 32 km et 55 km avec 1 800 m de D+."),
        ligne("Trailer Park"),                                   # « trail » dans un autre mot
        ligne("Rando VTT des vendanges"),                        # autre sport
        ligne("VTT et trail du Mont", description="Trail 25 km"),  # « trail » explicite : gardé
        ligne("Semi-marathon de la ville"),                      # distance déduite : 21,1 km
        ligne("Trail passé", periodes="2026-03-01<->2026-03-01"),  # fini
        ligne("Trail sans catégorie sport", categories="https://www.datatourisme.fr/ontology/core#CulturalEvent"),
        ligne("La Sancerroise", description="Course à pied dans les vignes, 12 km."),  # nom neutre mais « course »
    ]
    courses = co.extraire_datatourisme(lignes, auj)
    noms = [c["nom"] for c in courses]
    assert noms == ["Trail des tranchées", "VTT et trail du Mont", "Semi-marathon de la ville"]
    t = courses[0]
    assert t["distances_km"] == [14, 18, 32, 55] and t["dplus_m"] == 1800 and t["type"] == "trail"
    assert t["date"] == "2027-03-20" and t["commune"] == "Verdun" and t["cp"] == "55100"
    assert t["site"] == "http://www.traildestranchees.com/" and t["auteur"] == "OT Grand Verdun"
    assert courses[2]["distances_km"] == [21.1] and courses[2]["type"] == "route"


def test_periode_suivante_et_dedoublonnage():
    auj = date(2026, 10, 21)
    assert co.prochaine_periode("2026-05-01<->2026-05-01|2027-05-01<->2027-05-02", auj) == ("2027-05-01", "2027-05-02")
    oa = [{"uid": 1, "title_fr": "Trail des Tranchées", "firstdate_begin": "2027-03-20T08:00:00+00:00",
           "lastdate_end": "2027-03-20T18:00:00+00:00", "location_coordinates": {"lat": 49.157, "lon": 5.379},
           "location_city": "Verdun", "description_fr": "", "originagenda_title": "Ville de Verdun"}]
    tout = co.extraire_datatourisme([ligne("Trail des tranchées", description="14 km")], auj) + co.extraire_openagenda(oa, auj)
    assert len(tout) == 2 and len(co.dedoublonner(tout)) == 1
