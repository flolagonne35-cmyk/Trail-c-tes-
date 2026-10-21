#!/usr/bin/env python3
"""Écrit app/src/calcul/reseaux.ts : la liste des réseaux de zone présents dans l'appli.

Le chargeur de l'appli a besoin d'un `require` écrit en toutes lettres pour chaque fichier (Metro
ne sait pas charger un nom calculé) ; ce script le génère depuis app/assets/data/reseau/*.reseau,
avec l'emprise de chaque zone pour choisir la bonne sans ouvrir les fichiers.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from exporter_app import NOMS_ZONES  # noqa: E402


def index(dossier: Path) -> str:
    lignes = []
    for f in sorted(dossier.glob("*.reseau")):
        r = json.loads(f.read_text())
        zones = r.get("zones") or []
        if not zones:
            continue
        emprise = [min(z[0] for z in zones), min(z[1] for z in zones), max(z[2] for z in zones), max(z[3] for z in zones)]
        libelle = NOMS_ZONES.get(f.stem, f.stem.capitalize())
        lignes.append(f'  {{ nom: "{f.stem}", libelle: "{libelle}", emprise: {json.dumps(emprise)}, noeuds: {len(r["noeuds"])}, '
                      f'fichier: require("../../assets/data/reseau/{f.name}") }},')
    return ("// Généré par scripts/index_reseaux.py : ne pas modifier à la main.\n"
            "// Réseaux de zone (voies pour les boucles), chargés seulement quand un départ tombe dedans.\n\n"
            "/* eslint-disable @typescript-eslint/no-require-imports */\n"
            "export type ReseauZone = { nom: string; libelle: string; emprise: number[]; noeuds: number; fichier: number };\n\n"
            "export const RESEAUX: ReseauZone[] = [\n" + "\n".join(lignes) + "\n];\n")


def main(argv=None) -> int:
    dossier = RACINE / "app/assets/data/reseau"
    sortie = RACINE / "app/src/calcul/reseaux.ts"
    sortie.write_text(index(dossier))
    print(sortie.read_text())
    return 0


if __name__ == "__main__":
    sys.exit(main())
