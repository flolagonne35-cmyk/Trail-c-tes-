#!/usr/bin/env python3
"""Calendrier des courses à pied à venir en France, depuis des données ouvertes (Licence Ouverte).

Aucune base ouverte ne recense toutes les courses avec leurs inscriptions (ITRA, UTMB, Betrail, la
FFA ou les sites d'inscription gardent la leur). Deux sources publiques, réutilisables légalement,
publient en revanche des courses avec leur date, leur lieu et leur site officiel :

- DATAtourisme (ADN Tourisme) : les événements saisis par les offices de tourisme, export CSV
  quotidien sur data.gouv.fr, sans compte. On garde les « SportsEvent » dont le nom évoque la
  course à pied (trail, marathon, foulées, corrida…).
  https://www.data.gouv.fr/datasets/datatourisme-la-plateforme-nationale-des-donnees-touristiques
- OpenAgenda : les agendas publics (communes, associations), en Licence Ouverte, via le jeu
  « evenements-publics-openagenda » (API Opendatasoft de Huwise).
  https://doc.openagenda.com/fr/article/des-agendas-en-donnees-ouvertes-opendata-1kv0rno/

Licence Ouverte 2.0 : on cite la source, le producteur de chaque course (office de tourisme,
agenda) et la date de mise à jour. Les distances et le D+ sont lus dans le texte de l'annonce :
ils sont indicatifs, l'appli renvoie toujours au site officiel.

  python scripts/courses_ouvertes.py                  # télécharge et écrit app/assets/data/courses.json
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
# lien permanent data.gouv.fr vers la dernière version du CSV « événements » (FMA) de DATAtourisme
URL_DATATOURISME = "https://www.data.gouv.fr/api/1/datasets/r/2c6023f2-ffce-4c1a-9728-bdc020e463b5"
URL_OPENAGENDA = "https://hub.huwise.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/exports/json"
CHAMPS_OPENAGENDA = ("uid,title_fr,firstdate_begin,lastdate_end,location_coordinates,location_city,"
                     "location_postalcode,canonicalurl,description_fr,longdescription_fr,originagenda_title,updatedat")

# nom d'une course à pied (texte sans accents, en minuscules)
COURSE = re.compile(r"\b(courses?|courir|trail|trails|marathon|semi[- ]marathon|foulees?|corrida|cross|ekiden|ultra[- ]?trail|"
                    r"course a pied|courses a pied|course pedestre|courses pedestres|course nature|course hors stade|"
                    r"run|running|kilometre vertical|km vertical|vertical race|skyrace|\d+ ?km)\b")
# autres sports : écartés sauf si le nom dit clairement « course » ou « trail » (ex. « VTT et trail »)
AUTRE_SPORT = re.compile(r"\b(vtt|velo|cyclo\w*|gravel|equestre|cheval|canoe|kayak|moto\w*|rallye|auto|natation|nage|"
                         r"swim\w*|petanque|golf|tennis|football|rugby|basket\w*|handball|ski|raquettes?|peche|"
                         r"cinema|film|exposition|concert|conference|projection)\b")
# nom d'événement qui n'est pas une course (visite, programme, sortie de groupe…) ou autre « course »
EXCLU_NOM = re.compile(r"\b(visites?|programme|animations?|station de trail|sorties?|stages?|initiation|ateliers?|expositions?|"
                       r"conferences?|projections?|course d.orientation|course camarguaise|course landaise|courses? hippiques?|"
                       r"course de cote|caisses? a savon|chasse|oeufs|squat|mois de la rando|bmx|karting|marche de \d+ ?km)\b")
# corrida taurine, soirée DJ « Marathon ! », courses de chevaux…
EXCLU_TEXTE = re.compile(r"\b(dj|djs|techno|electro|line.?up|clubbing|taureaux?|toros?|novillada|feria|hippodrome|trot|galop|"
                         r"tauromachie|bmx)\b")
DUREE_MAX_JOURS = 7  # au-delà, c'est un programme ou un équipement, pas une course
FORT = re.compile(r"\b(trail|marathon|foulees?|corrida|course a pied|course pedestre|course nature)\b")
DISTANCE = re.compile(r"(\d{1,3}(?:[.,]\d{1,3})?)\s?(?:km|kms|kilom[eè]tres?)\b", re.I)
DPLUS = re.compile(r"(\d{1,2}[ .\u202f\u00a0]\d{3}|\d{2,5})\s?(?:m|metres|mètres)\s?(?:de\s)?(?:d\+|dénivelé positif|dénivelé|denivele|D\+)",
                   re.I)
TRAIL = re.compile(r"\b(trail|nature|vertical|sky\w*|ultra|montagne|cross)\b")


def sans_accents(texte: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texte or "") if unicodedata.category(c) != "Mn").lower()


def est_course(nom: str, description: str = "") -> bool:
    n = sans_accents(nom)
    if EXCLU_NOM.search(n) or EXCLU_TEXTE.search(sans_accents(description)[:1500]):
        return False
    if not COURSE.search(n):
        # nom neutre (« La Sancerroise ») : la description doit parler de course à pied
        d = sans_accents(description)[:600]
        if not re.search(r"\b(course a pied|trail|semi-marathon|marathon|course pedestre)\b", d) or not re.search(r"\bcourse", n):
            return False
    return not AUTRE_SPORT.search(n) or bool(FORT.search(n))


def distances(texte: str) -> list[float]:
    vus = set()
    for m in DISTANCE.finditer(texte or ""):
        v = float(m.group(1).replace(",", "."))
        if 1 <= v <= 250:
            vus.add(round(v, 1))
    t = sans_accents(texte)
    if not vus and re.search(r"\bsemi[- ]marathon\b", t):
        vus.add(21.1)
    if not any(v > 40 for v in vus) and re.search(r"(?<!semi-)(?<!semi )\bmarathon\b", t):
        vus.add(42.2)
    return sorted(vus)


def denivele(texte: str) -> int | None:
    valeurs = [int(re.sub(r"[ .\u202f\u00a0]", "", m.group(1))) for m in DPLUS.finditer(texte or "")]
    valeurs = [v for v in valeurs if 20 <= v <= 12000]
    return max(valeurs) if valeurs else None


def prochaine_periode(periodes: str, aujourdhui: date) -> tuple[str, str] | None:
    """« 2027-06-12<->2027-06-12|… » → la première période qui n'est pas finie."""
    for p in sorted((periodes or "").split("|")):
        morceaux = p.split("<->")
        try:
            debut = date.fromisoformat(morceaux[0].strip()[:10])
            fin = date.fromisoformat((morceaux[1] if len(morceaux) > 1 else morceaux[0]).strip()[:10])
        except ValueError:
            continue
        if fin >= aujourdhui and (fin - debut).days <= DUREE_MAX_JOURS:
            return debut.isoformat(), fin.isoformat()
    return None


def premier_lien(texte: str) -> str:
    m = re.search(r"https?://[^\s#|<>\"]+", texte or "")
    return m.group(0).rstrip(".,;)") if m else ""


def fiche(nom, debut, fin, lat, lon, commune, cp, texte, site, source, auteur, maj, ident) -> dict:
    d = distances(f"{nom} {texte}")
    dplus = denivele(texte)
    return {
        "id": ident, "nom": re.sub(r"\s+", " ", nom).strip(), "date": debut, "fin": fin,
        "lat": round(float(lat), 5), "lon": round(float(lon), 5), "commune": commune, "cp": cp,
        "distances_km": d, "dplus_m": dplus,
        "type": "trail" if TRAIL.search(sans_accents(nom)) or (dplus and d and dplus / max(d) > 15) else "route",
        "site": site, "source": source, "auteur": auteur, "maj": maj,
    }


def extraire_datatourisme(lignes, aujourdhui: date) -> list[dict]:
    res = []
    for l in lignes:
        if "SportsEvent" not in (l.get("Categories_de_POI") or "") and "SportsCompetition" not in (l.get("Categories_de_POI") or ""):
            continue
        nom = l.get("Nom_du_POI") or ""
        description = l.get("Description") or ""
        if not est_course(nom, description):
            continue
        periode = prochaine_periode(l.get("Periodes_regroupees") or "", aujourdhui)
        try:
            lat, lon = float(l["Latitude"]), float(l["Longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if not periode:
            continue
        cp, _, commune = (l.get("Code_postal_et_commune") or "").partition("#")
        res.append(fiche(nom, *periode, lat, lon, commune, cp, description, premier_lien(l.get("Contacts_du_POI") or ""),
                         "DATAtourisme", l.get("Createur_de_la_donnee") or "", l.get("Date_de_mise_a_jour") or "",
                         "dt-" + (l.get("URI_ID_du_POI") or nom).rsplit("/", 1)[-1]))
    return res


def extraire_openagenda(enregistrements, aujourdhui: date) -> list[dict]:
    res = []
    for e in enregistrements:
        nom = e.get("title_fr") or ""
        texte = f"{e.get('description_fr') or ''} {e.get('longdescription_fr') or ''}"
        coord = e.get("location_coordinates") or {}
        if not est_course(nom, texte) or "lat" not in coord:
            continue
        debut = (e.get("firstdate_begin") or "")[:10]
        fin = (e.get("lastdate_end") or debut)[:10]
        if not debut or fin < aujourdhui.isoformat() or (date.fromisoformat(fin) - date.fromisoformat(debut)).days > DUREE_MAX_JOURS:
            continue
        res.append(fiche(nom, debut, fin, coord["lat"], coord["lon"], e.get("location_city") or "",
                         e.get("location_postalcode") or "", texte, premier_lien(texte) or e.get("canonicalurl") or "",
                         "OpenAgenda", e.get("originagenda_title") or "", (e.get("updatedat") or "")[:10],
                         f"oa-{e.get('uid')}"))
    return res


def dedoublonner(courses: list[dict]) -> list[dict]:
    """Même course publiée par deux sources (ou deux offices) : même date, même nom, à moins de 5 km."""
    garde: dict[tuple, dict] = {}
    for c in courses:
        cle = (c["date"], re.sub(r"[^a-z0-9]", "", sans_accents(c["nom"]))[:30], round(c["lat"] * 20), round(c["lon"] * 20))
        if cle not in garde or (not garde[cle]["distances_km"] and c["distances_km"]):
            garde[cle] = c
    return sorted(garde.values(), key=lambda c: (c["date"], c["nom"]))


def telecharger(url: str, params=None, essais: int = 4):
    import requests
    for i in range(essais):
        try:
            r = requests.get(url, params=params, timeout=300,
                             headers={"User-Agent": "trail-cotes/0.1 (+https://github.com/flolagonne35-cmyk/Trail-c-tes-)"})
            r.raise_for_status()
            return r
        except Exception as e:  # noqa: BLE001 - réseau : on réessaie, puis on abandonne cette source
            print(f"  {url} : {e}", flush=True)
            time.sleep(5 * (i + 1))
    return None


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sortie", default=str(RACINE / "app/assets/data/courses.json"))
    p.add_argument("--rapport", default=str(RACINE / "resultats/courses/rapport.json"))
    args = p.parse_args(argv)
    aujourdhui = date.today()
    rapport: dict = {"date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sources": {}}
    courses: list[dict] = []

    r = telecharger(URL_DATATOURISME)
    if r is not None:
        r.encoding = "utf-8"
        lignes = list(csv.DictReader(io.StringIO(r.text)))
        trouvees = extraire_datatourisme(lignes, aujourdhui)
        courses += trouvees
        sport = [l for l in lignes if "SportsEvent" in (l.get("Categories_de_POI") or "")]
        rapport["sources"]["DATAtourisme"] = {"evenements": len(lignes), "sportifs": len(sport), "courses": len(trouvees),
                                              "exemple_brut": lignes[0] if lignes else None,
                                              "sportifs_ecartes": [l["Nom_du_POI"] for l in sport if not est_course(l["Nom_du_POI"], l.get("Description") or "")][:80]}
    else:
        rapport["sources"]["DATAtourisme"] = {"erreur": "téléchargement impossible"}

    where = (f'firstdate_begin >= "{aujourdhui.isoformat()}" and (search("trail") or search("marathon") or search("foulées") '
             'or search("corrida") or search("course à pied") or search("course nature") or search("cross"))')
    r = telecharger(URL_OPENAGENDA, {"where": where, "select": CHAMPS_OPENAGENDA, "limit": -1})
    if r is not None:
        enregistrements = r.json()
        trouvees = extraire_openagenda(enregistrements, aujourdhui)
        courses += trouvees
        rapport["sources"]["OpenAgenda"] = {"evenements": len(enregistrements), "courses": len(trouvees),
                                            "exemple_brut": enregistrements[0] if enregistrements else None}
    else:
        rapport["sources"]["OpenAgenda"] = {"erreur": "téléchargement impossible"}

    courses = dedoublonner(courses)
    rapport["courses"] = len(courses)
    rapport["statut"] = "ok" if courses else "echec"
    rapport["apercu"] = [f'{c["date"]} {c["nom"]} ({c["commune"]}) {c["distances_km"]} D+{c["dplus_m"]} {c["type"]}' for c in courses[:60]]
    if courses:
        sortie = Path(args.sortie)
        sortie.parent.mkdir(parents=True, exist_ok=True)
        sortie.write_text(json.dumps({
            "source": "DATAtourisme (offices de tourisme) et OpenAgenda, Licence Ouverte 2.0",
            "date_utc": rapport["date_utc"], "courses": courses,
        }, ensure_ascii=False, separators=(",", ":")))
        rapport["taille_ko"] = round(sortie.stat().st_size / 1024)
    Path(args.rapport).parent.mkdir(parents=True, exist_ok=True)
    Path(args.rapport).write_text(json.dumps(rapport, ensure_ascii=False, indent=2, default=str) + "\n")
    print(json.dumps({k: v for k, v in rapport.items() if k != "apercu"}, ensure_ascii=False, default=str)[:2000])
    return 0 if courses else 2


if __name__ == "__main__":
    sys.exit(main())
