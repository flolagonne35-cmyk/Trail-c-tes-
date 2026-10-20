#!/usr/bin/env python3
"""Icône de l'application (iOS, Android adaptative et monochrome), écran de démarrage et favicon.

Dessin : deux lignes de crêtes, un soleil orange et un sentier blanc qui grimpe en lacets jusqu'au
sommet, aux couleurs de l'appli. Dessiné en 4× puis réduit (anticrénelage).
  python scripts/generer_icones.py      # écrit app/assets/*.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ENCRE = (27, 42, 34)
CRETE_LOIN = (46, 74, 59)
CRETE_PRES = (37, 61, 48)
ORANGE = (217, 84, 30)
SABLE = (244, 241, 234)
DOSSIER = Path(__file__).resolve().parents[1] / "app" / "assets"
K = 4  # suréchantillonnage


def pts(liste, taille, echelle=1.0, decalage=(0, 0)):
    """Coordonnées données sur 100 → pixels, avec mise à l'échelle autour du centre (zone sûre Android)."""
    c = 50
    return [((c + (x - c) * echelle + decalage[0]) * taille / 100, (c + (y - c) * echelle + decalage[1]) * taille / 100)
            for x, y in liste]


def marque(taille, fond=True, echelle=1.0, mono=False):
    t = taille * K
    im = Image.new("RGBA", (t, t), ENCRE + (255,) if fond else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    blanc = (255, 255, 255, 255)
    soleil = blanc if mono else ORANGE + (255,)
    loin = blanc if mono else CRETE_LOIN + (255,)
    pres = blanc if mono else CRETE_PRES + (255,)
    # soleil
    (sx, sy), = pts([(74, 28)], t, echelle)
    r = 11 * t / 100 * echelle
    d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=soleil)
    # crêtes
    # les crêtes débordent toujours jusqu'aux bords (le masque Android les recadre) ; seuls les symboles
    # (soleil, sentier, drapeau) sont réduits dans la zone sûre
    sommet = pts([(52, 32)], t, echelle)[0]
    sy100 = sommet[1] * 100 / t
    d.polygon(pts([(0, sy100 + 42), (22, sy100 + 18), (34, sy100 + 28), (sommet[0] * 100 / t, sy100), (68, sy100 + 22),
                   (80, sy100 + 12), (100, sy100 + 34), (100, 100), (0, 100)], t), fill=loin)
    if not mono:
        d.polygon(pts([(0, sy100 + 54), (18, sy100 + 40), (34, sy100 + 48), (54, sy100 + 30), (72, sy100 + 44), (100, sy100 + 38),
                       (100, 100), (0, 100)], t), fill=pres)
    # sentier en lacets jusqu'au sommet
    sentier = pts([(30, 96), (52, 86), (38, 78), (56, 68), (46, 58), (54, 46), (52, 32)], t, echelle)
    couleur = (0, 0, 0, 0) if mono else SABLE + (255,)  # monochrome : le sentier est découpé (transparent)
    d.line(sentier, fill=couleur, width=int(3.2 * t / 100 * echelle), joint="curve")
    for x, y in sentier[1:-1]:
        rr = 1.6 * t / 100 * echelle
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=couleur)
    # drapeau au sommet
    (fx, fy), = pts([(52, 32)], t, echelle)
    u = t / 100 * echelle
    d.line([(fx, fy), (fx, fy - 12 * u)], fill=couleur, width=int(1.6 * u))
    d.polygon([(fx, fy - 12 * u), (fx + 8 * u, fy - 9.5 * u), (fx, fy - 7 * u)], fill=blanc if mono else ORANGE + (255,))
    return im.resize((taille, taille), Image.LANCZOS)


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    marque(1024).convert("RGB").save(DOSSIER / "icon.png")  # iOS : carré plein, sans transparence
    # Android adaptative : premier plan dans la zone sûre (66 % centraux), fond uni
    marque(1024, fond=False, echelle=0.62).save(DOSSIER / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), ENCRE).save(DOSSIER / "android-icon-background.png")
    marque(1024, fond=False, echelle=0.62, mono=True).save(DOSSIER / "android-icon-monochrome.png")
    marque(1024, fond=False, echelle=0.9).save(DOSSIER / "splash-icon.png")
    marque(48).save(DOSSIER / "favicon.png")
    print("icônes écrites dans", DOSSIER)


if __name__ == "__main__":
    main()
