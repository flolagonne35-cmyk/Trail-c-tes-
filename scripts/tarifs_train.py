"""Prix du train vers les courses, en données ouvertes SNCF (licence ODbL, ressources.data.sncf.com).

Trois jeux de données, sans clé :
- « Tarifs TGV INOUI et OUIGO » : pour chaque origine-destination, la fourchette du plein tarif
  (prix minimum et maximum selon le jour et l'heure de réservation) par classe et profil ;
- « Tarifs Intercités » : la même chose pour les Intercités ;
- « Gares de voyageurs » : le nom et la position de chaque gare (code UIC).
Les TER n'ont pas de tarifs publiés en données ouvertes : l'appli le dit et renvoie vers SNCF Connect.

On garde la 2de classe, profil « Tarif Normal » (sans carte), et l'on écrit un fichier compact que
l'appli charge une fois : app/public/trains/tarifs.json
    {"source", "date", "gares": [[uic, nom, lat, lon]...], "trajets": [[i, j, prix_min, prix_max, types]...]}
où i et j sont des indices de gares (i < j : un trajet vaut dans les deux sens) et `types` un masque
(1 TGV INOUI, 2 OUIGO, 4 Intercités). Le rapport resultats/trains/rapport.json garde un exemple brut.

    python scripts/tarifs_train.py
"""

from __future__ import annotations

import json
import sys
import time
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
API = "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/{}/exports/json"
SORTIE = RACINE / "app/public/trains/tarifs.json"
RAPPORT = RACINE / "resultats/trains/rapport.json"
TYPES = {"TGV INOUI": 1, "OUIGO": 2, "INTERCITES": 4}


def type_de(transporteur: str) -> int:
    t = transporteur.upper().replace("É", "E")
    if "OUIGO" in t:
        return TYPES["OUIGO"]
    if "INTERCITES" in t:
        return TYPES["INTERCITES"]
    return TYPES["TGV INOUI"]


def tarif_normal_2de(r: dict) -> bool:
    return str(r.get("classe")) == "2" and str(r.get("profil_tarifaire", "")).strip().lower() == "tarif normal"


def compiler(tgv: list[dict], intercites: list[dict], gares: list[dict]) -> dict:
    """Trajets (dans les deux sens) et gares utiles, à partir des enregistrements bruts."""
    position: dict[str, tuple[str, float, float]] = {}
    for g in gares:
        p = g.get("position_geographique") or {}
        if p.get("lat") is None:
            continue
        for uic in str(g.get("codes_uic") or "").replace(",", ";").split(";"):
            uic = uic.strip()[-8:]
            if uic:
                position[uic] = (g.get("nom") or "", round(float(p["lat"]), 5), round(float(p["lon"]), 5))
    paires: dict[tuple[str, str], list] = {}
    noms: dict[str, str] = {}

    def ajouter(a, b, nom_a, nom_b, pmin, pmax, transporteur):
        if not a or not b or a == b or pmin is None or pmax is None:
            return
        noms.setdefault(a, nom_a)
        noms.setdefault(b, nom_b)
        cle = (a, b) if a < b else (b, a)
        v = paires.setdefault(cle, [float("inf"), 0.0, 0])
        v[0] = min(v[0], float(pmin))
        v[1] = max(v[1], float(pmax))
        v[2] |= type_de(transporteur)

    for r in tgv:
        if tarif_normal_2de(r):
            ajouter(str(r.get("gare_origine_code_uic", ""))[-8:], str(r.get("gare_destination_code_uic", ""))[-8:],
                    r.get("gare_origine", ""), r.get("gare_destination", ""), r.get("prix_minimum"), r.get("prix_maximum"),
                    r.get("transporteur", ""))
    for r in intercites:
        if tarif_normal_2de(r) and str(r.get("type_place", "assise")).lower() == "assise":
            ajouter(str(r.get("origine_uic8", ""))[-8:], str(r.get("destination_uic8", ""))[-8:],
                    r.get("origine", ""), r.get("destination", ""), r.get("prix_min"), r.get("prix_max"), "Intercités")

    # seules les gares dont on connaît la position servent (l'appli cherche la gare la plus proche)
    utiles = sorted({u for cle in paires for u in cle if u in position})
    indice = {u: i for i, u in enumerate(utiles)}
    trajets = [[indice[a], indice[b], round(v[0], 2), round(v[1], 2), v[2]]
               for (a, b), v in sorted(paires.items()) if a in indice and b in indice]
    sans_position = sorted({noms[u] for cle in paires for u in cle if u not in position})
    return {
        "source": "SNCF Voyageurs, données ouvertes (ODbL) : tarifs TGV INOUI, OUIGO, Intercités ; gares de voyageurs",
        "date": date.today().isoformat(),
        "gares": [[u, position[u][0], position[u][1], position[u][2]] for u in utiles],
        "trajets": trajets,
        "sans_position": sans_position,
    }


def telecharger(jeu: str) -> list[dict]:
    import requests

    for essai in range(4):
        try:
            r = requests.get(API.format(jeu), timeout=180)
            r.raise_for_status()
            return r.json()
        except Exception as e:  # noqa: BLE001
            print(f"{jeu} : essai {essai + 1} raté ({e})", file=sys.stderr)
            time.sleep(5 * (essai + 1))
    raise RuntimeError(f"{jeu} : indisponible")


def main() -> int:
    RAPPORT.parent.mkdir(parents=True, exist_ok=True)
    try:
        tgv, ic, gares = (telecharger(j) for j in ("tarifs-tgv-inoui-ouigo", "tarifs-intercites", "gares-de-voyageurs"))
    except RuntimeError as e:
        # repli : on garde le fichier de la fois précédente
        RAPPORT.write_text(json.dumps({"statut": "erreur", "erreur": str(e)}, ensure_ascii=False, indent=1))
        print(e, file=sys.stderr)
        return 1
    res = compiler(tgv, ic, gares)
    sans = res.pop("sans_position")
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":")))
    RAPPORT.write_text(json.dumps({
        "statut": "ok", "date": res["date"], "enregistrements": {"tgv": len(tgv), "intercites": len(ic), "gares": len(gares)},
        "gares": len(res["gares"]), "trajets": len(res["trajets"]), "taille_ko": round(SORTIE.stat().st_size / 1024),
        "gares_sans_position": sans[:80], "exemple_brut": {"tgv": tgv[:1], "intercites": ic[:1], "gares": gares[:1]},
    }, ensure_ascii=False, indent=1))
    print(f"{len(res['gares'])} gares, {len(res['trajets'])} trajets, {SORTIE.stat().st_size // 1024} Ko ; {len(sans)} gares sans position")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
