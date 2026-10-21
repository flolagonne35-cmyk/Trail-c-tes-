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
        ligne("La Sancerroise", description="Course à pied dans les vignes, 12 km."),  # nom neutre, annonce explicite
        ligne("Visite guidée : Corrida"),                        # visite
        ligne("Corrida de la feria", description="Six taureaux dans les arènes."),  # corrida taurine
        ligne("Station de trail : programme", periodes="2026-01-01<->2026-12-31"),  # programme sur l'année
        ligne("Course féminine : Courir pour elles", description="5 km"),  # « course » : gardée
    ]
    courses = co.extraire_datatourisme(lignes, auj)
    noms = [c["nom"] for c in courses]
    assert noms == ["Trail des tranchées", "VTT et trail du Mont", "Semi-marathon de la ville", "La Sancerroise",
                    "Course féminine : Courir pour elles"]
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


def test_distances_semi_et_marathon():
    assert co.distances("Marathon de Nantes + Semi-marathon + Foulées") == [21.1, 42.2]
    assert co.distances("Semi-marathon de la ville") == [21.1]
    assert co.distances("Marathon, 10 km et semi") == [10, 42.2]
    assert co.distances("Semi-Marathon de la Chalosse : 5 et 10 km aussi") == [5, 10, 21.1]


def test_courses_sur_route():
    auj = date(2026, 10, 21)
    lignes = [ligne("Les 10 km de Cholet"), ligne("Les Boucles de la Vallée", description="5 et 10 km"),
              ligne("Demi-marathon de Vannes"), ligne("Marathon d'écriture de nouvelle"), ligne("Marathon de l'intérim"),
              ligne("Rando des châteaux"), ligne("Course internationale de chiens de traîneau"),
              ligne("Ronde de Noël du Veilleur de Nuit")]
    c = co.extraire_datatourisme(lignes, auj)
    assert [x["nom"] for x in c] == ["Les 10 km de Cholet", "Les Boucles de la Vallée", "Demi-marathon de Vannes"]
    assert [x["distances_km"] for x in c] == [[10], [5, 10], [21.1]] and {x["type"] for x in c} == {"route"}


def test_cas_reels_du_rapport():
    """Événements sportifs réels de DATAtourisme (rapport du 21/10/2026)."""
    gardes = [("La Corrida du Puy-en-Velay - 9ème édition", "La Corrida du Puy est une grande fête animée du running, avec DJ."),
              ("La BVB (Trail et randonnée pédestre)", "BVB (course et randonnée pédestre)."),
              ("Montmerle Obscure Race", "La MOR est une course nocturne."),
              ("L'ARRACHÉE", "La course d'obstacles L'Arrachée se déroulera dans le parc."),
              ("Hard'Iden Blanc 2027 : trail et ski de randonnée", ""),
              ("Movember", "Marche, trail et canicross. Circuit de 3km, 6 km et 12 km."),
              ("Marche ou course pour tous !", "Venez en famille"), ("MY ROSE : COURSE/MARCHE CONTRE LE CANCER DU SEIN", "")]
    ecartes = [("Ronde d'échecs - Open du Pays Fouesnantais", ""), ("Concours de belote", ""), ("Randonnée nocturne", "8 km"),
               ("Course d'orientation", "Sprint"), ("Courses hippiques", "L'hippodrome accueille une réunion de courses"),
               ("Marche octobre rose", "8 km"), ("Concours de saut d'obstacles", ""),
               ("Eliza Rose : Marathon !", "Soirée DJ techno jusqu'à l'aube"),
               ("Courses de ski FIS internationales Homme - Ski Chrono National Tour", ""),
               ("Courses à l'hippodrome", "Assistez aux courses à l'hippodrome"),
               ("Table ronde autour du sport féminin", ""), ("La Ronde des Histoires - Manteau blanc", "")]
    assert [n for n, d in gardes if not co.est_course(n, d)] == []
    assert [n for n, d in ecartes if co.est_course(n, d)] == []
