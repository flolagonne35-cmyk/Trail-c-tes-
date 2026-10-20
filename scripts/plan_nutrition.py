#!/usr/bin/env python3
"""Plan nutrition par tronçon entre ravitaillements (écran « Nutrition et ravitos »).

Entrée : le parcours.json produit par segmenter_gpx.py, un objectif de temps, les ravitaillements
et les préférences (glucides, eau, sodium par heure).

Temps de passage : chaque tranche de 50 m du profil pèse selon le coût énergétique de la course
en pente (Minetti et al., 2002, J Appl Physiol 93:1039), rapporté au plat ; le total est recalé
sur l'objectif. Une côte à 10 % « coûte » ainsi environ 1,7 fois le plat, une descente à −10 %
environ 0,6 fois. Au-delà de ±45 % la pente est plafonnée.

Besoins : débits horaires choisis (défauts : 70 g de glucides, 500 ml d'eau, 600 mg de sodium),
augmentés avec la chaleur (eau et sodium +10 % par tranche de 5 °C au-dessus de 15 °C).
Les quantités sont converties en unités : gels, barres, flasques, pastilles de sel.

Sorties (dans --sortie) : plan.csv, plan.json, plan.md (lisible), rapport.json.

Exemple :
  python scripts/plan_nutrition.py resultats/tmb/parcours.json --objectif 38h \\
      --ravito "31:Les Contamines" --ravito "50:Les Chapieux" --ravito "76:Courmayeur" --temperature 22
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


def cout_minetti(i: np.ndarray) -> np.ndarray:
    """Coût énergétique de la course (J/kg/m) selon la pente i (fraction), Minetti 2002."""
    i = np.clip(i, -0.45, 0.45)
    return 155.4 * i**5 - 30.4 * i**4 - 43.3 * i**3 + 46.3 * i**2 + 19.5 * i + 3.6


def lire_objectif(texte: str) -> float:
    """« 38h », « 5h40 », « 5:40 », « 340min » ou « 5.5 » → heures."""
    t = texte.strip().lower().replace(" ", "")
    if m := re.fullmatch(r"(\d+)[h:](\d{1,2})?", t):
        return int(m[1]) + int(m[2] or 0) / 60
    if m := re.fullmatch(r"(\d+)min", t):
        return int(m[1]) / 60
    return float(t.replace(",", "."))


def lire_ravito(texte: str) -> tuple[float, str]:
    km, _, nom = texte.partition(":")
    return float(km.replace(",", ".")), nom.strip() or f"km {km}"


def heures_lisibles(h: float) -> str:
    m = round(h * 60)
    return f"{m // 60} h {m % 60:02d}"


@dataclass
class Troncon:
    n: int
    de: str
    a: str
    km_debut: float
    km_fin: float
    dplus_m: int
    duree_h: float
    passage_h: float  # heure de course à l'arrivée du tronçon
    passage: str
    glucides_g: int
    eau_ml: int
    sodium_mg: int
    gels: int
    barres: int
    eau_l: float
    pastilles_sel: int
    resume: str


def construire_plan(parcours: dict, objectif_h: float, ravitos: list[tuple[float, str]], prefs) -> list[Troncon]:
    d = np.array(parcours["profil"]["d_km"]) * 1000
    z = np.array(parcours["profil"]["z_m"])
    total = parcours["distance_km"] * 1000
    if d[-1] < total:  # dernier point du profil : l'arrivée
        d, z = np.append(d, total), np.append(z, z[-1])
    pente = np.diff(z) / np.maximum(np.diff(d), 1e-9)
    poids = np.diff(d) * cout_minetti(pente) / cout_minetti(np.zeros(1))[0]
    t_cumul = np.concatenate([[0.0], np.cumsum(poids)]) / poids.sum() * objectif_h

    chaleur = 1 + 0.10 * max(0.0, (prefs.temperature - 15) / 5)
    arrets = [(0.0, "Départ")] + sorted((k, n) for k, n in ravitos if 0 < k < total / 1000) \
        + [(total / 1000, "Arrivée")]
    plan = []
    for n, ((k0, n0), (k1, n1)) in enumerate(zip(arrets, arrets[1:]), start=1):
        t0, t1 = np.interp([k0 * 1000, k1 * 1000], d, t_cumul)
        duree = t1 - t0
        sel = (d >= k0 * 1000) & (d <= k1 * 1000)
        dplus = int(np.clip(np.diff(z[sel]), 0, None).sum()) if sel.sum() > 1 else 0
        glucides = prefs.glucides * duree
        eau = prefs.eau * duree * chaleur
        sodium = prefs.sodium * duree * chaleur
        g_solide = glucides * prefs.part_solide
        barres = math.ceil(g_solide / prefs.barre_g - 0.2) if g_solide > 0 else 0
        gels = max(0, math.ceil((glucides - barres * prefs.barre_g) / prefs.gel_g - 0.2))
        eau_l = math.ceil(eau / 250) * 0.25
        pastilles = max(0, math.ceil((sodium - gels * prefs.sodium_gel_mg) / prefs.pastille_mg - 0.2))
        morceaux = [f"{gels} gel{'s' * (gels > 1)}"] if gels else []
        morceaux += [f"{barres} barre{'s' * (barres > 1)}"] if barres else []
        morceaux += [f"{eau_l:g} L d'eau".replace(".", ",")]
        morceaux += [f"{pastilles} pastille{'s' * (pastilles > 1)} sel"] if pastilles else []
        plan.append(Troncon(
            n=n, de=n0, a=n1, km_debut=round(k0, 1), km_fin=round(k1, 1), dplus_m=dplus,
            duree_h=round(duree, 2), passage_h=round(t1, 2), passage=heures_lisibles(t1),
            glucides_g=round(glucides), eau_ml=round(eau), sodium_mg=round(sodium),
            gels=gels, barres=barres, eau_l=eau_l, pastilles_sel=pastilles, resume=" · ".join(morceaux)))
    return plan


def ecrire_markdown(chemin: Path, parcours: dict, objectif_h: float, prefs, plan: list[Troncon]) -> None:
    lignes = [f"# Plan nutrition — {parcours['nom']}", "",
              f"Objectif {heures_lisibles(objectif_h)} · {parcours['distance_km']} km · D+ {parcours['dplus_m']} m · "
              f"{prefs.temperature:g} °C", "",
              f"Par heure : {prefs.glucides:g} g de glucides, {prefs.eau:g} ml d'eau, {prefs.sodium:g} mg de sodium "
              "(eau et sodium ajustés à la chaleur).", "",
              "| Tronçon | km | D+ | Passage | Emporter |", "|---|---|---|---|---|"]
    lignes += [f"| {t.de} → {t.a} | {t.km_debut:g} – {t.km_fin:g} | {t.dplus_m} m | {t.passage} | {t.resume} |"
               for t in plan]
    lignes += ["", "Temps estimés par le coût énergétique de la course en pente (Minetti 2002), recalés sur "
               "l'objectif. Quantités indicatives, à ajuster selon votre tolérance digestive."]
    chemin.write_text("\n".join(lignes) + "\n")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("parcours", help="parcours.json produit par segmenter_gpx.py")
    p.add_argument("--objectif", required=True, help="temps visé : 38h, 5h40, 340min…")
    p.add_argument("--ravito", action="append", default=[], help="« km:nom », à répéter")
    p.add_argument("--glucides", type=float, default=70, help="g par heure (défaut 70)")
    p.add_argument("--eau", type=float, default=500, help="ml par heure (défaut 500)")
    p.add_argument("--sodium", type=float, default=600, help="mg par heure (défaut 600)")
    p.add_argument("--temperature", type=float, default=15, help="température prévue en °C (défaut 15)")
    p.add_argument("--part-solide", type=float, default=0.0,
                   help="part des glucides en barres plutôt qu'en gels, 0 à 1 (défaut 0)")
    p.add_argument("--gel-g", type=float, default=25, help="glucides par gel (défaut 25 g)")
    p.add_argument("--barre-g", type=float, default=40, help="glucides par barre (défaut 40 g)")
    p.add_argument("--sodium-gel-mg", type=float, default=50, help="sodium par gel (défaut 50 mg)")
    p.add_argument("--pastille-mg", type=float, default=250, help="sodium par pastille de sel (défaut 250 mg)")
    p.add_argument("--sortie", default=None, help="dossier de sortie (défaut : celui du parcours)")
    args = p.parse_args(argv)

    parcours = json.loads(Path(args.parcours).read_text())
    sortie = Path(args.sortie or Path(args.parcours).parent)
    sortie.mkdir(parents=True, exist_ok=True)
    objectif = lire_objectif(args.objectif)
    plan = construire_plan(parcours, objectif, [lire_ravito(r) for r in args.ravito], args)

    with (sortie / "plan.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(Troncon.__dataclass_fields__))
        w.writeheader()
        w.writerows(asdict(t) for t in plan)
    contenu = {"parcours": parcours["nom"], "objectif_h": objectif,
               "par_heure": {"glucides_g": args.glucides, "eau_ml": args.eau, "sodium_mg": args.sodium},
               "temperature_c": args.temperature, "troncons": [asdict(t) for t in plan]}
    (sortie / "plan.json").write_text(json.dumps(contenu, ensure_ascii=False, indent=2) + "\n")
    ecrire_markdown(sortie / "plan.md", parcours, objectif, args, plan)
    rapport = {"date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "statut": "ok",
               "resume": {f"{t.de} → {t.a}": f"{t.passage} — {t.resume}" for t in plan}}
    (sortie / "rapport_nutrition.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")
    for t in plan:
        print(f"  {t.de} → {t.a} (km {t.km_debut:g} – {t.km_fin:g}, passage {t.passage}) : {t.resume}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
