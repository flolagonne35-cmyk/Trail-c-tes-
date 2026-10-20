#!/usr/bin/env python3
"""Détection des zones pentues autour d'un point (France), à partir du RGE ALTI de l'IGN.

Étapes :
  1. grille régulière (pas en mètres) dans un carré de rayon R autour du point ;
  2. altitudes via le service de calcul altimétrique de la Géoplateforme (data.geopf.fr) ;
  3. lissage gaussien (le MNT à 1 m est bruité) en ignorant les points sans donnée ;
  4. pente (%) par différences finies ;
  5. zones pentues = composantes connexes où la pente dépasse un seuil.

Sorties (dans --sortie) :
  grille.csv   une ligne par point : lat, lon, z brut, z lissé, pente
  zones.csv    une ligne par zone pentue
  carte.png    ombrage + pente + contours des zones
  rapport.json paramètres, statistiques et erreurs de l'API

Code de sortie : 0 si tout va bien, 2 si l'API a renvoyé trop d'erreurs ou de points
sans donnée (seuil --max-echec), 1 pour une erreur inattendue.

Exemple :
  python scripts/cotes_rennes.py --lat 48.1113 --lon -1.6800 --rayon 2000 --pas 20
  python scripts/cotes_rennes.py --demo        # relief fictif, sans appel réseau
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trailcotes.ign import (  # noqa: E402
    RAYON_TERRE, RENNES_LAT, RENNES_LON, RESSOURCE_DEFAUT, StatsApi, altitudes_ign,
)


# --------------------------------------------------------------------------- grille

@dataclass
class Grille:
    lat0: float
    lon0: float
    pas: float
    x: np.ndarray  # décalages est-ouest en mètres (colonnes)
    y: np.ndarray  # décalages nord-sud en mètres (lignes, du nord vers le sud)

    @property
    def forme(self) -> tuple[int, int]:
        return len(self.y), len(self.x)

    def latlon(self) -> tuple[np.ndarray, np.ndarray]:
        """Lat/lon de chaque nœud (projection équirectangulaire locale, suffisante sur quelques km)."""
        xx, yy = np.meshgrid(self.x, self.y)
        lat = self.lat0 + np.degrees(yy / RAYON_TERRE)
        lon = self.lon0 + np.degrees(xx / (RAYON_TERRE * math.cos(math.radians(self.lat0))))
        return lat, lon


def construire_grille(lat0: float, lon0: float, rayon: float, pas: float) -> Grille:
    n = int(round(rayon / pas))
    x = np.arange(-n, n + 1) * pas
    y = np.arange(n, -n - 1, -1) * pas  # nord en haut, comme sur une carte
    return Grille(lat0, lon0, pas, x, y)


# --------------------------------------------------------------------------- API IGN


def relief_fictif(grille: Grille, graine: int = 0) -> np.ndarray:
    """Relief synthétique : deux collines, une vallée et du bruit façon MNT 1 m."""
    xx, yy = np.meshgrid(grille.x, grille.y)
    rng = np.random.default_rng(graine)
    z = (60
         + 40 * np.exp(-((xx - 500) ** 2 + (yy - 300) ** 2) / (2 * 350 ** 2))
         + 25 * np.exp(-((xx + 700) ** 2 + (yy + 600) ** 2) / (2 * 200 ** 2))
         - 15 * np.exp(-(yy + 100) ** 2 / (2 * 150 ** 2)))
    return z + rng.normal(0, 0.5, z.shape)


# --------------------------------------------------------------------------- calculs

def lisser(z: np.ndarray, sigma_m: float, pas: float) -> np.ndarray:
    """Gaussienne normalisée : les NaN ne contaminent pas leurs voisins."""
    sigma = sigma_m / pas
    if sigma <= 0:
        return z.copy()
    valide = np.isfinite(z)
    num = ndimage.gaussian_filter(np.where(valide, z, 0.0), sigma, mode="nearest")
    den = ndimage.gaussian_filter(valide.astype(float), sigma, mode="nearest")
    with np.errstate(invalid="ignore", divide="ignore"):
        out = num / den
    out[~valide] = np.nan
    return out


def pente_pct(z: np.ndarray, pas: float) -> np.ndarray:
    dz_dy, dz_dx = np.gradient(z, pas)
    return np.hypot(dz_dx, dz_dy) * 100.0


@dataclass
class Zone:
    id: int
    lat: float
    lon: float
    surface_m2: float
    pente_moy_pct: float
    pente_max_pct: float
    alt_min_m: float
    alt_max_m: float
    denivele_m: float
    etendue_m: float  # plus grande dimension de la boîte englobante


def zones_pentues(z: np.ndarray, pente: np.ndarray, grille: Grille,
                  pente_min: float, surface_min: float) -> tuple[list[Zone], np.ndarray]:
    masque = np.isfinite(pente) & (pente >= pente_min)
    etiquettes, n = ndimage.label(masque, structure=np.ones((3, 3)))
    lat, lon = grille.latlon()
    aire_cellule = grille.pas ** 2
    zones: list[Zone] = []
    for i, sl in enumerate(ndimage.find_objects(etiquettes), start=1):
        m = etiquettes[sl] == i
        surface = m.sum() * aire_cellule
        if surface < surface_min:
            etiquettes[etiquettes == i] = 0
            continue
        p, zz = pente[sl][m], z[sl][m]
        h, w = m.shape
        zones.append(Zone(
            id=i,
            lat=round(float(lat[sl][m].mean()), 6),
            lon=round(float(lon[sl][m].mean()), 6),
            surface_m2=round(float(surface)),
            pente_moy_pct=round(float(p.mean()), 1),
            pente_max_pct=round(float(p.max()), 1),
            alt_min_m=round(float(np.nanmin(zz)), 1),
            alt_max_m=round(float(np.nanmax(zz)), 1),
            denivele_m=round(float(np.nanmax(zz) - np.nanmin(zz)), 1),
            etendue_m=round(float(max(h, w) * grille.pas)),
        ))
    zones.sort(key=lambda zn: (zn.denivele_m, zn.pente_moy_pct), reverse=True)
    return zones, etiquettes


# --------------------------------------------------------------------------- sorties

def ecrire_grille_csv(chemin: Path, grille: Grille, z_brut, z_lisse, pente) -> None:
    lat, lon = grille.latlon()
    with chemin.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lat", "lon", "z_brut_m", "z_lisse_m", "pente_pct"])
        for row in zip(lat.ravel(), lon.ravel(), z_brut.ravel(), z_lisse.ravel(), pente.ravel()):
            w.writerow([f"{row[0]:.6f}", f"{row[1]:.6f}"] +
                       ["" if not np.isfinite(v) else f"{v:.2f}" for v in row[2:]])


def ecrire_zones_csv(chemin: Path, zones: list[Zone]) -> None:
    champs = list(Zone.__dataclass_fields__)
    with chemin.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=champs)
        w.writeheader()
        for zn in zones:
            w.writerow(asdict(zn))


def dessiner_carte(chemin: Path, grille: Grille, z, pente, etiquettes, zones,
                   pente_min: float, titre: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import LightSource

    etendue = [grille.x[0], grille.x[-1], grille.y[-1], grille.y[0]]
    fig, ax = plt.subplots(figsize=(10, 9), dpi=120)
    z_aff = np.where(np.isfinite(z), z, np.nanmean(z) if np.isfinite(z).any() else 0)
    ombrage = LightSource(azdeg=315, altdeg=45).hillshade(z_aff, vert_exag=3, dx=grille.pas, dy=grille.pas)
    ax.imshow(ombrage, cmap="gray", extent=etendue, alpha=0.9)
    vmax = max(pente_min * 2, float(np.nanpercentile(pente, 99)) if np.isfinite(pente).any() else 1)
    im = ax.imshow(np.ma.masked_invalid(pente), cmap="magma_r", extent=etendue, alpha=0.55, vmin=0, vmax=vmax)
    ax.contour(grille.x, grille.y, etiquettes > 0, levels=[0.5], colors="#00a6d6", linewidths=1.2)
    for i, zn in enumerate(zones[:15], start=1):
        ys, xs = np.nonzero(etiquettes == zn.id)
        if len(xs):
            centre = (grille.x[xs].mean(), grille.y[ys].mean())
            ax.annotate(str(i), centre, color="white", fontsize=8, ha="center", va="center",
                        bbox=dict(boxstyle="circle,pad=0.2", fc="#00a6d6", ec="none"))
    ax.plot(0, 0, marker="*", color="red", markersize=14, markeredgecolor="white")
    fig.colorbar(im, ax=ax, shrink=0.8, label="Pente (%)")
    ax.set_xlabel("Est (m depuis le centre)")
    ax.set_ylabel("Nord (m depuis le centre)")
    ax.set_title(titre, fontsize=11)
    fig.tight_layout()
    fig.savefig(chemin)
    plt.close(fig)


# --------------------------------------------------------------------------- main

def analyser(args: argparse.Namespace) -> int:
    sortie = Path(args.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    grille = construire_grille(args.lat, args.lon, args.rayon, args.pas)
    print(f"Grille {grille.forme[0]}×{grille.forme[1]} = {grille.forme[0] * grille.forme[1]} points, pas {args.pas} m")

    stats = StatsApi(ressource=args.ressource)
    if args.demo:
        z_brut = relief_fictif(grille)
        source = "relief fictif (--demo)"
    else:
        lat, lon = grille.latlon()
        z_brut = altitudes_ign(lat, lon, args.ressource, args.taille_lot, args.pause, args.essais, stats)
        source = f"IGN Géoplateforme, ressource {args.ressource}"

    taux_valide = float(np.isfinite(z_brut).mean())
    z_lisse = lisser(z_brut, args.lissage, args.pas)
    pente = pente_pct(z_lisse, args.pas)
    zones, etiquettes = zones_pentues(z_lisse, pente, grille, args.pente_min, args.surface_min)

    ecrire_grille_csv(sortie / "grille.csv", grille, z_brut, z_lisse, pente)
    ecrire_zones_csv(sortie / "zones.csv", zones)
    titre = (f"Zones ≥ {args.pente_min:g} % autour de ({args.lat:.4f}, {args.lon:.4f}) — "
             f"rayon {args.rayon:g} m, pas {args.pas:g} m\nSource : {source}")
    if taux_valide > 0:
        dessiner_carte(sortie / "carte.png", grille, z_lisse, pente, etiquettes, zones, args.pente_min, titre)

    echec = (1 - taux_valide) > args.max_echec
    rapport = {
        "date_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "statut": "echec_api" if echec else "ok",
        "source": source,
        "parametres": {k: v for k, v in vars(args).items() if k != "sortie"},
        "grille": {"lignes": grille.forme[0], "colonnes": grille.forme[1]},
        "points_valides_pct": round(100 * taux_valide, 2),
        "altitude_min_m": None if taux_valide == 0 else round(float(np.nanmin(z_brut)), 2),
        "altitude_max_m": None if taux_valide == 0 else round(float(np.nanmax(z_brut)), 2),
        "pente_p95_pct": None if taux_valide == 0 else round(float(np.nanpercentile(pente, 95)), 1),
        "nb_zones": len(zones),
        "resume": {
            "Points valides": f"{100 * taux_valide:.2f} %",
            "Altitudes": f"{np.nanmin(z_brut):.1f} → {np.nanmax(z_brut):.1f} m" if taux_valide else "—",
            "Zones pentues": len(zones),
            "Requêtes altimétrie": f"{stats.requetes} (OK {stats.requetes_ok}, réessais {stats.reessais})",
        },
        "api": None if args.demo else asdict(stats),
    }
    (sortie / "rapport.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + "\n")

    print(f"{len(zones)} zones ≥ {args.pente_min:g} %, {rapport['points_valides_pct']} % de points valides")
    for zn in zones[:5]:
        print(f"  ({zn.lat}, {zn.lon}) D {zn.denivele_m} m, pente moy {zn.pente_moy_pct} %, max {zn.pente_max_pct} %")
    if echec:
        print(f"ÉCHEC : {100 * (1 - taux_valide):.1f} % de points sans altitude (seuil {100 * args.max_echec:g} %)",
              file=sys.stderr)
        return 2
    return 0


def parser_arguments(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lat", type=float, default=RENNES_LAT)
    p.add_argument("--lon", type=float, default=RENNES_LON)
    p.add_argument("--rayon", type=float, default=2000, help="demi-côté du carré analysé, en m (défaut 2000)")
    p.add_argument("--pas", type=float, default=20, help="pas de la grille en m (défaut 20)")
    p.add_argument("--lissage", type=float, default=30, help="sigma du lissage gaussien en m (défaut 30)")
    p.add_argument("--pente-min", type=float, default=5, help="seuil de pente en %% (défaut 5)")
    p.add_argument("--surface-min", type=float, default=2000, help="surface mini d'une zone en m² (défaut 2000)")
    p.add_argument("--ressource", default=RESSOURCE_DEFAUT, help="ressource altimétrique IGN")
    p.add_argument("--taille-lot", type=int, default=150, help="points par requête (défaut 150)")
    p.add_argument("--pause", type=float, default=0.25, help="pause entre requêtes en s (défaut 0.25)")
    p.add_argument("--essais", type=int, default=4, help="tentatives par lot (défaut 4)")
    p.add_argument("--max-echec", type=float, default=0.05,
                   help="part max de points sans altitude avant d'échouer (défaut 0.05)")
    p.add_argument("--sortie", default="resultats/rennes")
    p.add_argument("--demo", action="store_true", help="relief fictif, sans appel à l'API")
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(analyser(parser_arguments()))
