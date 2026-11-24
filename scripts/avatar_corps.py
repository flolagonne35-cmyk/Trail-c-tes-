"""Prépare le corps 3D de l'avatar à partir de MakeHuman (licence CC0 : libre, y compris dans une appli
payante, sans attribution obligatoire ; on la cite quand même).

Entrée : le dossier `makehuman/data` du dépôt https://github.com/makehumancommunity/makehuman
(3dobjs/base.obj, targets/macrodetails/...).
Sortie : un fichier binaire compact (app/public/avatar/corps.bin) que l'appli charge une fois :
- les sommets du corps et des yeux (en décimètres, l'unité de MakeHuman), les triangles ;
- pour chaque sommet, une zone (visage, cuir chevelu, torse, cuisse, pied, œil…) qui sert à
  habiller le coureur (t-shirt, short, chaussettes, chaussures) et à poser les cheveux ;
- 22 « cibles » de morphologie, en décalages quantifiés sur 8 bits :
  18 universelles (femme ou homme × musculature min / moyenne / max × poids min / moyen / max),
  auxquelles on ajoute le mélange neutre des trois cibles d'origine (africaine, asiatique,
  caucasienne, 1/3 chacune) ; et 4 cibles de taille (petit ou grand, femme ou homme).
L'appli mélange ces cibles comme MakeHuman (poids par produits de fonctions affines par
morceaux) à partir de la taille en cm, du poids en kg et de la morphologie choisis.

Format : 4 octets (longueur L de l'en-tête), L octets d'en-tête JSON, puis, alignés sur 4 octets,
positions Float32 (n×3), triangles Uint16 (t×3), zones Uint8 (n), puis chaque cible Int8 (n×3),
à multiplier par son « echelle » ; puis le squelette (version 2) : os de chaque sommet Uint8 (n×4),
poids Uint8 (n×4, total 255), pivots des os Float32 (os×3), décalage des pivots par cible Float32
(cibles×os×3). Le squelette et ses poids viennent aussi de MakeHuman (rigs/default.*, CC0).

    python scripts/avatar_corps.py --data <makehuman/data> --sortie app/public/avatar/corps.bin
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

GROUPES = ("body", "helper-l-eye", "helper-r-eye")
GENRES = ("female", "male")
NIVEAUX = ("min", "average", "max")
ORIGINES = ("african", "asian", "caucasian")

# zones (même liste dans app/src/avatar3d/zones.ts)
ZONES = ["visage", "crane", "cou", "torse_haut", "torse_bas", "hanches", "cuisse_haut", "cuisse_bas", "mollet_haut",
         "mollet_bas", "pied", "bras_haut", "bras_bas", "avant_bras", "main", "oeil_blanc", "iris", "pupille", "barbe"]
Z = {nom: i for i, nom in enumerate(ZONES)}


def lire_obj(chemin: Path):
    """Sommets et faces (par groupe) d'un .obj MakeHuman."""
    sommets: list[tuple[float, float, float]] = []
    faces: dict[str, list[list[int]]] = {}
    groupe = ""
    for ligne in chemin.read_text().splitlines():
        if ligne.startswith("v "):
            x, y, z = map(float, ligne.split()[1:4])
            sommets.append((x, y, z))
        elif ligne.startswith("g "):
            groupe = ligne.split()[1]
        elif ligne.startswith("f "):
            faces.setdefault(groupe, []).append([int(p.split("/")[0]) - 1 for p in ligne.split()[1:]])
    return sommets, faces


def lire_cible(chemin: Path) -> dict[int, tuple[float, float, float]]:
    """Décalages d'une cible MakeHuman : « indice dx dy dz » par ligne (les lignes # sont des commentaires)."""
    res = {}
    for ligne in chemin.read_text().splitlines():
        if not ligne.strip() or ligne.startswith("#"):
            continue
        i, dx, dy, dz = ligne.split()[:4]
        res[int(i)] = (float(dx), float(dy), float(dz))
    return res


def centre(sommets, faces, groupe):
    ids = {i for f in faces[groupe] for i in f}
    return tuple(sum(sommets[i][k] for i in ids) / len(ids) for k in range(3))


def distance_segment(p, a, b) -> tuple[float, float]:
    """Distance du point p au segment [a, b], et position t (0 en a, 1 en b) de son projeté."""
    ab = [b[k] - a[k] for k in range(3)]
    ap = [p[k] - a[k] for k in range(3)]
    l2 = sum(v * v for v in ab) or 1e-9
    t = max(0.0, min(1.0, sum(ap[k] * ab[k] for k in range(3)) / l2))
    q = [a[k] + t * ab[k] for k in range(3)]
    return math.dist(p, q), t


def est_barbe(p, oeil) -> bool:
    """Bas du visage où pousse la barbe : sous le nez (moustache comprise), sans les lèvres, plus les
    favoris devant les oreilles. Repères pris sur le maillage de base (bouche ≈ 0,7 dm sous les yeux)."""
    x, y, z = abs(p[0]), p[1], p[2]
    sous_nez = y < oeil[1] - 0.36
    levres = x < 0.24 and oeil[1] - 0.9 < y < oeil[1] - 0.5 and z > oeil[2] + 0.12
    favoris = y < oeil[1] + 0.05 and x > 0.58 and oeil[2] - 0.75 < z < oeil[2] - 0.2
    return (sous_nez and not levres) or favoris


def zones(sommets, faces, ids: list[int]) -> list[int]:
    """Zone de chaque sommet retenu : segment osseux le plus proche, puis position le long du segment."""
    j = lambda g: centre(sommets, faces, g)  # noqa: E731
    bassin, cou, tete, haut_tete = j("joint-pelvis"), j("joint-neck"), j("joint-head"), j("joint-head-2")
    oeil_g, oeil_d = j("helper-l-eye"), j("helper-r-eye")
    yeux = {i for g in ("helper-l-eye", "helper-r-eye") for f in faces[g] for i in f}
    res = []
    for i in ids:
        p = sommets[i]
        if i in yeux:
            c = oeil_g if p[0] > 0 else oeil_d
            r = max(1e-6, math.dist(p, c))
            avant = (p[2] - c[2]) / r  # 1 : regard droit devant
            res.append(Z["pupille"] if avant > 0.93 else Z["iris"] if avant > 0.78 else Z["oeil_blanc"])
            continue
        cote = "l" if p[0] >= 0 else "r"
        segs = {
            "tronc": (bassin, cou), "tete": (cou, haut_tete),
            "bras": (j(f"joint-{cote}-shoulder"), j(f"joint-{cote}-elbow")),
            "avant_bras": (j(f"joint-{cote}-elbow"), j(f"joint-{cote}-hand")),
            "cuisse": (j(f"joint-{cote}-upper-leg"), j(f"joint-{cote}-knee")),
            "jambe": (j(f"joint-{cote}-knee"), j(f"joint-{cote}-ankle")),
            "pied": (j(f"joint-{cote}-ankle"), j(f"joint-{cote}-foot-2")),
        }
        # le tronc est épais : on réduit sa distance pour que hanches et épaules lui reviennent
        meilleur, d_min, t_min = "", 1e9, 0.0
        for nom, (a, b) in segs.items():
            d, t = distance_segment(p, a, b)
            d *= 0.55 if nom == "tronc" else 1.0
            if d < d_min:
                meilleur, d_min, t_min = nom, d, t
        y = p[1]
        if meilleur == "tete" or y > cou[1] + 0.35:
            # cuir chevelu : haut du crâne et arrière de la tête, au-dessus de la nuque
            # cuir chevelu : dessus, arrière, et côtés au-dessus des oreilles (tempes)
            crane = (y > oeil_g[1] + 0.55 or (p[2] < tete[2] - 0.15 and y > oeil_g[1] - 0.9)
                     or (abs(p[0]) > 0.55 and y > oeil_g[1] + 0.1 and p[2] < oeil_g[2] - 0.3))
            zone = Z["crane"] if crane else Z["visage"] if y > cou[1] + 0.35 else Z["cou"]
            if zone == Z["visage"] and est_barbe(p, oeil_g):
                zone = Z["barbe"]
            res.append(zone)
        elif meilleur == "tronc":
            taille = bassin[1] + 0.25 * (cou[1] - bassin[1])  # hauteur de la ceinture
            aisselle = bassin[1] + 0.72 * (cou[1] - bassin[1])
            res.append(Z["cou"] if y > cou[1] - 0.15 else Z["torse_haut"] if y > aisselle else Z["torse_bas"] if y > taille else Z["hanches"])
        elif meilleur == "bras":
            res.append(Z["bras_haut"] if t_min < 0.45 else Z["bras_bas"])
        elif meilleur == "avant_bras":
            res.append(Z["main"] if t_min > 0.97 else Z["avant_bras"])
        elif meilleur == "cuisse":
            res.append(Z["hanches"] if t_min < 0.12 else Z["cuisse_haut"] if t_min < 0.55 else Z["cuisse_bas"])
        elif meilleur == "jambe":
            res.append(Z["mollet_haut"] if t_min < 0.62 else Z["mollet_bas"] if t_min < 0.93 else Z["pied"])
        else:
            res.append(Z["pied"])
    return res


# Squelette simplifié pour la pose de course : 19 os, chacun regroupant des os de MakeHuman
# (rigs/default.mhskel, CC0). (nom, parent, os MakeHuman dont la tête sert de pivot, os regroupés)
OS = [("bassin", None, "spine05", ["root", "spine05", "pelvis.L", "pelvis.R"]),
      ("dos", "bassin", "spine04", ["spine04", "spine03", "spine02"]),
      ("poitrine", "dos", "spine01", ["spine01", "breast.L", "breast.R", "clavicle.L", "clavicle.R"]),
      ("cou", "poitrine", "neck01", ["neck01", "neck02", "neck03"]),
      ("tete", "cou", "head", ["head"])]
for _c, _C in (("G", "L"), ("D", "R")):
    OS += [(f"epaule{_c}", "poitrine", f"shoulder01.{_C}", [f"shoulder01.{_C}"]),
           (f"bras{_c}", f"epaule{_c}", f"upperarm01.{_C}", [f"upperarm01.{_C}", f"upperarm02.{_C}"]),
           (f"avantbras{_c}", f"bras{_c}", f"lowerarm01.{_C}", [f"lowerarm01.{_C}", f"lowerarm02.{_C}"]),
           (f"main{_c}", f"avantbras{_c}", f"wrist.{_C}", [f"wrist.{_C}"]),
           (f"cuisse{_c}", "bassin", f"upperleg01.{_C}", [f"upperleg01.{_C}", f"upperleg02.{_C}"]),
           (f"jambe{_c}", f"cuisse{_c}", f"lowerleg01.{_C}", [f"lowerleg01.{_C}", f"lowerleg02.{_C}"]),
           (f"pied{_c}", f"jambe{_c}", f"foot.{_C}", [f"foot.{_C}"])]


def squelette(data: Path, nouvel: dict[int, int], n: int):
    """Os simplifiés : pivots (moyenne des sommets de l'articulation, comme MakeHuman) et, pour chaque
    sommet gardé, ses 4 os les plus influents (poids sur 255)."""
    sq = json.loads((data / "rigs/default.mhskel").read_text())
    poids_mh = json.loads((data / "rigs/default_weights.mhw").read_text())["weights"]
    direct = {mh: k for k, (_, _, _, groupe) in enumerate(OS) for mh in groupe}

    def os_simple(nom: str) -> int:
        # doigts, orteils, visage… : on remonte les parents jusqu'à un os gardé
        while nom not in direct:
            nom = sq["bones"][nom]["parent"]
        return direct[nom]

    influences = [dict() for _ in range(n)]
    for nom, liste in poids_mh.items():
        k = os_simple(nom)
        for ancien, w in liste:
            if ancien in nouvel:
                d = influences[nouvel[ancien]]
                d[k] = d.get(k, 0.0) + w
    indices, poids = bytearray(), bytearray()
    for d in influences:
        top = sorted(d.items(), key=lambda kv: -kv[1])[:4] or [(OS.index(next(o for o in OS if o[0] == "tete")), 1.0)]
        total = sum(w for _, w in top)
        q = [round(255 * w / total) for _, w in top]
        q[0] += 255 - sum(q)
        top += [(0, 0.0)] * (4 - len(top))
        q += [0] * (4 - len(q))
        indices += bytes(k for k, _ in top)
        poids += bytes(q)
    articulations = [sq["joints"][f"{pivot}____head"] for _, _, pivot, _ in OS]
    return indices, poids, articulations


def construire(data: Path) -> bytes:
    sommets, faces = lire_obj(data / "3dobjs/base.obj")
    garder = sorted({i for g in GROUPES for f in faces[g] for i in f})
    nouvel = {ancien: k for k, ancien in enumerate(garder)}
    triangles = []
    for g in GROUPES:
        for f in faces[g]:
            q = [nouvel[i] for i in f]
            triangles += [q[0], q[1], q[2]] + ([q[0], q[2], q[3]] if len(q) == 4 else [])
    macro = data / "targets/macrodetails"
    # mélange neutre des origines, par genre
    origine = {g: {} for g in GENRES}
    for g in GENRES:
        for o in ORIGINES:
            for i, d in lire_cible(macro / f"{o}-{g}-young.target").items():
                v = origine[g].setdefault(i, [0.0, 0.0, 0.0])
                for k in range(3):
                    v[k] += d[k] / len(ORIGINES)
    cibles: list[tuple[str, dict]] = []
    for g in GENRES:
        for m in NIVEAUX:
            for w in NIVEAUX:
                c = {i: list(d) for i, d in lire_cible(macro / f"universal-{g}-young-{m}muscle-{w}weight.target").items()}
                # les poids universels d'un genre somment à 1 : ajouter l'origine à chacun revient à l'appliquer une fois
                for i, d in origine[g].items():
                    v = c.setdefault(i, [0.0, 0.0, 0.0])
                    for k in range(3):
                        v[k] += d[k]
                cibles.append((f"{g}-{m}muscle-{w}weight", c))
        for h in ("min", "max"):
            cibles.append((f"{g}-{h}height", lire_cible(macro / f"height/{g}-young-averagemuscle-averageweight-{h}height.target")))

    n = len(garder)
    indices_os, poids_os, articulations = squelette(data, nouvel, n)
    centre_art = lambda pos, ids: [sum(pos(i)[k] for i in ids) / len(ids) for k in range(3)]  # noqa: E731
    pivots = [c for ids in articulations for c in centre_art(lambda i: sommets[i], ids)]
    # décalage des pivots par cible : la moyenne des décalages des sommets de l'articulation
    pivots_cibles = [[c for ids in articulations for c in centre_art(lambda i, cb=cb: cb.get(i, (0.0, 0.0, 0.0)), ids)]
                     for _, cb in cibles]
    morceaux = [struct.pack(f"<{n * 3}f", *[c for i in garder for c in sommets[i]]),
                struct.pack(f"<{len(triangles)}H", *triangles),
                bytes(zones(sommets, faces, garder))]
    infos = []
    for nom, c in cibles:
        vals = [c.get(i, (0.0, 0.0, 0.0)) for i in garder]
        echelle = max(1e-6, max(abs(x) for v in vals for x in v)) / 127
        morceaux.append(struct.pack(f"<{n * 3}b", *[max(-127, min(127, round(x / echelle))) for v in vals for x in v]))
        infos.append({"nom": nom, "echelle": echelle})
    morceaux += [bytes(indices_os), bytes(poids_os), struct.pack(f"<{len(pivots)}f", *pivots),
                 struct.pack(f"<{len(pivots) * len(cibles)}f", *[c for pc in pivots_cibles for c in pc])]
    entete = json.dumps({"version": 2, "sommets": n, "triangles": len(triangles) // 3, "zones": ZONES, "cibles": infos,
                         "os": [{"nom": nom, "parent": parent} for nom, parent, _, _ in OS],
                         "source": "MakeHuman (CC0), makehumancommunity/makehuman"}, ensure_ascii=False).encode()
    sortie = bytearray(struct.pack("<I", len(entete)) + entete)
    for m in morceaux:
        while len(sortie) % 4:
            sortie.append(0)
        sortie += m
    return bytes(sortie)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", required=True, help="dossier makehuman/data")
    p.add_argument("--sortie", default=str(Path(__file__).resolve().parents[1] / "app/public/avatar/corps.bin"))
    a = p.parse_args(argv)
    binaire = construire(Path(a.data))
    Path(a.sortie).parent.mkdir(parents=True, exist_ok=True)
    Path(a.sortie).write_bytes(binaire)
    print(f"{a.sortie} : {len(binaire) / 1024:.0f} Ko")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
