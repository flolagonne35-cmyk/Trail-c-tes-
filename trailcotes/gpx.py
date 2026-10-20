"""Lecture et écriture de traces GPX (bibliothèque standard uniquement)."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np


def lire_gpx(chemin: str | Path) -> tuple[str, np.ndarray, np.ndarray, np.ndarray]:
    """(nom, lat, lon, ele) des points de trace (trkpt), à défaut de route (rtept). ele = NaN si absente."""
    racine = ET.parse(chemin).getroot()

    def locaux(tag):  # ignore l'espace de noms (GPX 1.0 ou 1.1)
        return [e for e in racine.iter() if e.tag.rsplit("}", 1)[-1] == tag]

    points = locaux("trkpt") or locaux("rtept")
    if not points:
        raise ValueError(f"{chemin} : aucun point trkpt ou rtept")
    lat = np.array([float(p.get("lat")) for p in points])
    lon = np.array([float(p.get("lon")) for p in points])
    ele = []
    for p in points:
        e = next((c.text for c in p if c.tag.rsplit("}", 1)[-1] == "ele"), None)
        ele.append(float(e) if e not in (None, "") else np.nan)
    noms = [e.text for e in locaux("name") if e.text]
    return (noms[0] if noms else Path(chemin).stem), lat, lon, np.array(ele)


def ecrire_gpx(chemin: str | Path, nom: str, lat, lon, ele=None) -> None:
    gpx = ET.Element("gpx", {"version": "1.1", "creator": "trail-cotes",
                             "xmlns": "http://www.topografix.com/GPX/1/1"})
    trk = ET.SubElement(gpx, "trk")
    ET.SubElement(trk, "name").text = nom
    seg = ET.SubElement(trk, "trkseg")
    for i, (la, lo) in enumerate(zip(lat, lon)):
        pt = ET.SubElement(seg, "trkpt", {"lat": f"{la:.6f}", "lon": f"{lo:.6f}"})
        if ele is not None and np.isfinite(ele[i]):
            ET.SubElement(pt, "ele").text = f"{ele[i]:.1f}"
    ET.indent(gpx)
    Path(chemin).write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(gpx, encoding="unicode") + "\n")
