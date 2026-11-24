"""Prix, réservation et dates d'inscription des courses, tirés de la base COMPLÈTE de DATAtourisme.

Le calendrier (scripts/courses_ouvertes.py) lit l'export CSV des événements, qui n'a qu'une partie
des champs : ni tarifs, ni contact de réservation. La base complète, elle, est publiée chaque jour
sur data.gouv.fr, sans clé et sous Licence Ouverte 2.0 : un fichier N-Triples compressé
(datatourisme.nt.zip, environ 2 Go), une ligne par fait « sujet prédicat objet ».
https://www.data.gouv.fr/datasets/datatourisme-la-plateforme-nationale-des-donnees-touristiques

On le lit en flux, sans le décompresser sur le disque, et on ne garde que le sous-graphe des courses
du calendrier : la course, puis les nœuds qu'elle désigne (offres, tarifs, contact de réservation),
jusqu'à 3 niveaux. Ontologie DATAtourisme (schema.org) : `:offers` → `schema:priceSpecification` →
`schema:minPrice` / `schema:maxPrice` / `schema:price` ; `:hasBookingContact` → `foaf:homepage` ;
dates de vente : `schema:validFrom` / `schema:validThrough`.
https://gitlab.adullact.net/adntourisme/datatourisme/ontology

    python scripts/datatourisme_complet.py [--zip datatourisme.nt.zip]
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tempfile
import zipfile
from collections import defaultdict
from collections.abc import Callable, Iterable
from datetime import date, timedelta
from pathlib import Path

from courses_ouvertes import prix_dans

RACINE = Path(__file__).resolve().parents[1]
API_JEU = "https://www.data.gouv.fr/api/1/datasets/datatourisme-la-plateforme-nationale-des-donnees-touristiques/"
COURSES = RACINE / "app/assets/data/courses.json"
RAPPORT = RACINE / "resultats/courses/datatourisme_complet.json"

LIGNE = re.compile(r'^(\S+) <([^>]+)> (.+?) \.\s*$')
LITTERAL = re.compile(r'^"((?:[^"\\]|\\.)*)"(?:@[\w-]+|\^\^<[^>]+>)?$')
# nœuds à suivre : nœuds anonymes et ressources de DATAtourisme (pas les termes de l'ontologie)
SUIVRE = re.compile(r"^(_:|<https?://data\.datatourisme\.fr/)")


def local(iri: str) -> str:
    """« http://schema.org/minPrice » → « minPrice »."""
    return re.split(r"[#/]", iri.rstrip("/"))[-1]


def valeur(o: str) -> str:
    m = LITTERAL.match(o)
    if m:
        try:
            return json.loads(f'"{m.group(1)}"')  # échappements N-Triples (\\", \\n, \\uXXXX) = ceux de JSON
        except ValueError:
            return m.group(1)
    return o.strip("<>")


def uuid_de(sujet: str) -> str:
    return sujet.strip("<>").rsplit("/", 1)[-1]


def extraire_graphe(ouvrir: Callable[[], Iterable[str]], uuids: set[str], passes: int = 4) -> dict[str, list[tuple[str, str]]]:
    """Faits (prédicat, objet) des courses et des nœuds qu'elles désignent, en quelques lectures du flux.

    Lecture 1 : les courses (sujet dont l'identifiant final est dans `uuids`) ; chaque nœud désigné
    devient « voulu », et s'il est décrit plus loin dans le fichier, il est pris dans la même lecture.
    Les lectures suivantes reprennent les nœuds voulus décrits plus haut que leur parent.
    """
    graphe: dict[str, list[tuple[str, str]]] = defaultdict(list)
    voulus: set[str] = set()
    vus: set[str] = set()
    for n in range(passes):
        avant = voulus - vus
        for ligne in ouvrir():
            espace = ligne.find(" ")
            if espace < 0:
                continue
            s = ligne[:espace]
            garder = s in voulus or (n == 0 and s.startswith("<https://data.datatourisme.fr/") and uuid_de(s) in uuids)
            if not garder or (n > 0 and s in vus):
                continue
            m = LIGNE.match(ligne)
            if not m:
                continue
            _, p, o = m.groups()
            graphe[s].append((p, o))
            if SUIVRE.match(o) and o not in graphe:
                voulus.add(o)
        vus |= set(graphe)
        manquants = voulus - vus
        if not manquants or (n > 0 and manquants == avant):  # rien de nouveau trouvé : inutile de relire
            break
    return graphe


def infos_course(graphe: dict[str, list[tuple[str, str]]], racine: str, profondeur: int = 4) -> dict:
    """Prix (€), lien de réservation, dates de vente et mention « complet », trouvés sous la course."""
    prix: set[float] = set()
    liens: list[str] = []
    debut, fin = [], []
    complet = False
    a_voir, vu = [(racine, 0, "")], set()
    while a_voir:
        noeud, niveau, via = a_voir.pop()
        if noeud in vu or niveau > profondeur:
            continue
        vu.add(noeud)
        for p, o in graphe.get(noeud, []):
            nom = local(p)
            if nom in ("minPrice", "maxPrice", "price"):
                try:
                    v = float(valeur(o).replace(",", "."))
                    if 0 < v < 2000:
                        prix.add(v)
                except ValueError:
                    pass
            elif nom == "textPriceSpecification":
                # tarifs écrits en clair (« 12 € sur internet, 15 € sur place ») : même lecture que les annonces
                prix.update(v for v in prix_dans(valeur(o)) if 0 < v < 2000)
            elif nom == "homepage" and "Booking" in via:
                liens.append(valeur(o))
            elif nom == "validFrom":
                debut.append(valeur(o)[:10])
            elif nom == "validThrough":
                fin.append(valeur(o)[:10])
            elif nom in ("availability",) and "SoldOut" in o:
                complet = True
            if SUIVRE.match(o):
                a_voir.append((o, niveau + 1, nom if niveau == 0 else via))
    return {"prix_eur": sorted(prix), "reservation": liens[0] if liens else "",
            "inscription_debut": min(debut) if debut else "", "inscription_fin": max(fin) if fin else "", "complet": complet}


def arbre(graphe, noeud, niveau=0, vu=None) -> dict:
    """Sous-graphe lisible d'une course, pour le rapport (exemple de réponse brute)."""
    vu = vu or set()
    if noeud in vu or niveau > 3:
        return {}
    vu.add(noeud)
    res: dict = {}
    for p, o in graphe.get(noeud, []):
        res.setdefault(local(p), []).append(arbre(graphe, o, niveau + 1, vu) if o in graphe else valeur(o)[:160])
    return res


def fusionner(courses: list[dict], infos: dict[str, dict]) -> int:
    """Complète les courses du calendrier ; ce que l'organisateur a écrit dans l'annonce reste prioritaire."""
    n = 0
    for c in courses:
        i = infos.get(c["id"])
        if not i:
            continue
        avant = json.dumps(c, sort_keys=True)
        if i["prix_eur"] and not c.get("prix_eur"):
            c["prix_eur"] = i["prix_eur"]
        if i["reservation"]:
            c["reservation"] = i["reservation"]
        # la période de validité d'une offre est le plus souvent le jour même de la course (vérifié
        # sur le run du 24/11 : 185 fiches sur 190) : seule une date AVANT la course parle d'inscription
        # et une date de plus de 8 mois avant vient en général de l'édition précédente
        jour = c.get("date") or "9999"
        plancher = (date.fromisoformat(jour) - timedelta(days=240)).isoformat() if jour != "9999" else ""
        for cle in ("inscription_debut", "inscription_fin"):
            if i[cle] and plancher <= i[cle] < jour:
                c[cle] = i[cle]
            else:
                c.pop(cle, None)
        if i["complet"]:
            c["complet"] = True
        n += avant != json.dumps(c, sort_keys=True)
    return n


def url_du_dump() -> str:
    import requests

    jeu = requests.get(API_JEU, timeout=60).json()
    for r in jeu["resources"]:
        if r["title"] == "datatourisme.nt.zip":
            return r["url"]
    raise RuntimeError("datatourisme.nt.zip introuvable sur data.gouv.fr")


def telecharger(url: str, chemin: Path) -> None:
    import requests

    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        with chemin.open("wb") as f:
            for morceau in r.iter_content(1 << 22):
                f.write(morceau)


def lecteur(zip_chemin: Path) -> Callable[[], Iterable[str]]:
    def ouvrir():
        with zipfile.ZipFile(zip_chemin) as z:
            for membre in z.namelist():
                if membre.endswith(".nt"):
                    with z.open(membre) as f:
                        yield from io.TextIOWrapper(f, encoding="utf-8", errors="replace")
    return ouvrir


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--zip", help="fichier datatourisme.nt.zip déjà téléchargé")
    a = p.parse_args(argv)
    RAPPORT.parent.mkdir(parents=True, exist_ok=True)
    donnees = json.loads(COURSES.read_text())
    courses = donnees["courses"]
    ids = {c["id"][3:]: c["id"] for c in courses if c["id"].startswith("dt-")}
    rapport: dict = {"courses_datatourisme": len(ids)}
    try:
        if a.zip:
            chemin = Path(a.zip)
        else:
            chemin = Path(tempfile.gettempdir()) / "datatourisme.nt.zip"
            url = url_du_dump()
            rapport["url"] = url
            telecharger(url, chemin)
        rapport["taille_mo"] = round(chemin.stat().st_size / 1e6)
        graphe = extraire_graphe(lecteur(chemin), set(ids))
    except Exception as e:  # noqa: BLE001
        # repli : le calendrier reste tel quel (prix relevés dans les descriptions)
        rapport["statut"] = "erreur"
        rapport["erreur"] = str(e)[:500]
        RAPPORT.write_text(json.dumps(rapport, ensure_ascii=False, indent=1))
        print(rapport, file=sys.stderr)
        return 1
    racines = {uuid_de(s): s for s in graphe if s.startswith("<https://data.datatourisme.fr/") and uuid_de(s) in ids}
    infos = {ids[u]: infos_course(graphe, s) for u, s in racines.items()}
    completees = fusionner(courses, infos)
    COURSES.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")))
    avec_prix = [u for u, s in racines.items() if infos[ids[u]]["prix_eur"]]
    rapport.update({
        "statut": "ok", "trouvees": len(racines), "noeuds": len(graphe), "completees": completees,
        "avec_prix": len(avec_prix), "avec_reservation": sum(1 for i in infos.values() if i["reservation"]),
        "avec_dates_inscription": sum(1 for i in infos.values() if i["inscription_debut"] or i["inscription_fin"]),
        "predicats": sorted({local(p) for faits in graphe.values() for p, _ in faits}),
        "exemple_brut": [arbre(graphe, racines[u]) for u in (avec_prix or list(racines))[:2]],
    })
    RAPPORT.write_text(json.dumps(rapport, ensure_ascii=False, indent=1))
    print({k: v for k, v in rapport.items() if k not in ("exemple_brut", "predicats")})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
