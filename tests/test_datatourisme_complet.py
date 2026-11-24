"""Tests hors réseau de la lecture de la base complète DATAtourisme (scripts/datatourisme_complet.py)."""

import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import datatourisme_complet as dc

DT = "https://www.datatourisme.fr/ontology/core#"
S = "http://schema.org/"
COURSE = "<https://data.datatourisme.fr/58/aaaa-1111>"
AUTRE = "<https://data.datatourisme.fr/58/bbbb-2222>"
# extrait au format N-Triples : le tarif est décrit AVANT la course (2e lecture), la réservation après
NT = f"""_:tarif <{S}minPrice> "12"^^<http://www.w3.org/2001/XMLSchema#decimal> .
_:tarif <{S}maxPrice> "18.5"^^<http://www.w3.org/2001/XMLSchema#decimal> .
{AUTRE} <{S}name> "Concert" .
{AUTRE} <{DT}offers> _:autre .
_:autre <{S}price> "99" .
_:offre <{S}priceSpecification> _:tarif .
_:offre <{S}validFrom> "2026-09-01"^^<http://www.w3.org/2001/XMLSchema#date> .
_:offre <{S}validThrough> "2027-03-10T23:59:00"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
{COURSE} <http://www.w3.org/2000/01/rdf-schema#label> "Trail des Cr\\u00EAtes"@fr .
{COURSE} <{DT}offers> _:offre .
{COURSE} <{DT}hasBookingContact> _:resa .
{COURSE} <{DT}hasTheme> <https://www.datatourisme.fr/ontology/core#Trail> .
_:resa <http://xmlns.com/foaf/0.1/homepage> "https://inscriptions.exemple.fr/trail"^^<http://www.w3.org/2001/XMLSchema#anyURI> .
"""


def lire(texte):
    return lambda: io.StringIO(texte)


def test_sous_graphe_de_la_course_seulement():
    g = dc.extraire_graphe(lire(NT), {"aaaa-1111"})
    assert COURSE in g and AUTRE not in g and "_:autre" not in g
    assert {"_:offre", "_:tarif", "_:resa"} <= set(g)  # tarif décrit avant : repris à la 2e lecture


def test_prix_reservation_dates():
    g = dc.extraire_graphe(lire(NT), {"aaaa-1111"})
    i = dc.infos_course(g, COURSE)
    assert i == {"prix_eur": [12.0, 18.5], "reservation": "https://inscriptions.exemple.fr/trail",
                 "inscription_debut": "2026-09-01", "inscription_fin": "2027-03-10", "complet": False}
    assert dc.arbre(g, COURSE)["label"] == ["Trail des Crêtes"]


def test_tarifs_en_texte_libre():
    nt = NT + f'{COURSE} <{DT}offers> _:o2 .\n_:o2 <{DT}textPriceSpecification> "Adultes : 20 € en ligne, 25 € sur place"@fr .\n'
    g = dc.extraire_graphe(lire(nt), {"aaaa-1111"})
    assert {20.0, 25.0} <= set(dc.infos_course(g, COURSE)["prix_eur"])


def test_fusion_garde_l_annonce_de_l_organisateur():
    courses = [{"id": "dt-aaaa-1111", "date": "2027-03-20", "prix_eur": [], "complet": False}, {"id": "dt-x", "prix_eur": [20]},
               {"id": "dt-y", "date": "2027-01-10", "prix_eur": [25]}]
    infos = {"dt-aaaa-1111": {"prix_eur": [12.0], "reservation": "https://r", "inscription_debut": "", "inscription_fin": "2027-03-10", "complet": False},
             # validité de l'offre = jour de la course : ce n'est pas une date d'inscription
             "dt-y": {"prix_eur": [30.0], "reservation": "", "inscription_debut": "2027-01-10", "inscription_fin": "2027-01-10", "complet": False}}
    assert dc.fusionner(courses, infos) == 1
    assert courses[0]["inscription_fin"] == "2027-03-10"
    assert "inscription_debut" not in courses[2] and "inscription_fin" not in courses[2]
    # date de l'édition précédente (plus de 8 mois avant) : écartée
    ancienne = [{"id": "dt-z", "date": "2026-12-06", "prix_eur": []}]
    dc.fusionner(ancienne, {"dt-z": {"prix_eur": [], "reservation": "", "inscription_debut": "2025-06-28", "inscription_fin": "2025-06-29", "complet": False}})
    assert "inscription_fin" not in ancienne[0]
    assert courses[0]["prix_eur"] == [12.0] and courses[0]["reservation"] == "https://r"
    assert courses[2]["prix_eur"] == [25]  # le prix écrit par l'organisateur reste


def test_lecture_dans_le_zip(tmp_path):
    z = tmp_path / "d.nt.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as f:
        f.writestr("datatourisme.nt", NT)
    g = dc.extraire_graphe(dc.lecteur(z), {"aaaa-1111"})
    assert dc.infos_course(g, COURSE)["prix_eur"] == [12.0, 18.5]
