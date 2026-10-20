"""Base SQLite des côtes précalculées : écriture par tuile, reprise, recherche autour d'un point."""

from __future__ import annotations

import json
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .ign import RAYON_TERRE

SCHEMA = """
CREATE TABLE IF NOT EXISTS cotes (
    id INTEGER PRIMARY KEY,
    cle TEXT UNIQUE,                 -- départ et arrivée arrondis : évite les doublons entre tuiles
    lat_depart REAL, lon_depart REAL, lat_arrivee REAL, lon_arrivee REAL,
    longueur_m REAL, pente_moy_pct REAL, pente_max_pct REAL, dplus_m REAL,
    alt_depart_m REAL, alt_arrivee_m REAL,
    type_voie TEXT, nature TEXT, nom TEXT, revetement TEXT, source_revetement TEXT, technicite TEXT,
    pentes_50m TEXT, profil TEXT, geometrie TEXT, tuile TEXT,
    adresse TEXT                     -- adresse du pied (géocodage inverse), NULL tant qu'elle n'est pas cherchée
);
CREATE INDEX IF NOT EXISTS cotes_position ON cotes (lat_depart, lon_depart);
CREATE TABLE IF NOT EXISTS tuiles (
    id TEXT PRIMARY KEY, lat REAL, lon REAL, statut TEXT, nb_cotes INTEGER,
    points_alti INTEGER, duree_s REAL, date_utc TEXT, detail TEXT
);
"""


def ouvrir(chemin: str | Path) -> sqlite3.Connection:
    Path(chemin).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(chemin)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    colonnes = {r[1] for r in con.execute("PRAGMA table_info(cotes)")}
    if "adresse" not in colonnes:  # bases créées avant l'ajout des adresses
        con.execute("ALTER TABLE cotes ADD COLUMN adresse TEXT")
    return con


def cle_cote(c) -> str:
    """~10 m de résolution sur le départ et l'arrivée."""
    return f"{c.lat_depart:.4f},{c.lon_depart:.4f},{c.lat_arrivee:.4f},{c.lon_arrivee:.4f}"


def tuile_faite(con: sqlite3.Connection, ident: str) -> bool:
    ligne = con.execute("SELECT statut FROM tuiles WHERE id = ?", (ident,)).fetchone()
    return ligne is not None and ligne["statut"] == "ok"


def enregistrer_tuile(con, ident: str, lat: float, lon: float, statut: str, cotes: list,
                      points_alti: int, duree_s: float, detail: dict) -> int:
    """Ajoute les côtes (ignore les doublons) et marque la tuile. Renvoie le nombre de côtes ajoutées."""
    avant = con.total_changes
    con.executemany(
        """INSERT OR IGNORE INTO cotes (cle, lat_depart, lon_depart, lat_arrivee, lon_arrivee, longueur_m,
           pente_moy_pct, pente_max_pct, dplus_m, alt_depart_m, alt_arrivee_m, type_voie, nature, nom, revetement,
           source_revetement, technicite, pentes_50m, profil, geometrie, tuile)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [(cle_cote(c), c.lat_depart, c.lon_depart, c.lat_arrivee, c.lon_arrivee, c.longueur_m, c.pente_moy_pct,
          c.pente_max_pct, c.dplus_m, c.alt_depart_m, c.alt_arrivee_m, c.type_voie, c.nature, c.nom, c.revetement,
          c.source_revetement, c.technicite, json.dumps(c.pentes_50m),
          json.dumps({"d_m": c.profil_d, "z_m": c.profil_z}), json.dumps(c.lonlat), ident) for c in cotes])
    ajoutees = con.total_changes - avant
    con.execute("INSERT OR REPLACE INTO tuiles VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (ident, lat, lon, statut, ajoutees, points_alti, round(duree_s, 1),
                 datetime.now(timezone.utc).isoformat(timespec="seconds"), json.dumps(detail, ensure_ascii=False)))
    con.commit()
    return ajoutees


def distance_m(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * RAYON_TERRE * math.asin(math.sqrt(a))


def cotes_proches(con, lat: float, lon: float, rayon_m: float, pente_min: float = 0,
                  types: tuple[str, ...] | None = None, limite: int = 50) -> list[dict]:
    """Côtes dont le départ est à moins de `rayon_m` (à vol d'oiseau), triées par distance."""
    dlat = math.degrees(rayon_m / RAYON_TERRE)
    dlon = math.degrees(rayon_m / (RAYON_TERRE * math.cos(math.radians(lat))))
    sql = """SELECT * FROM cotes WHERE lat_depart BETWEEN ? AND ? AND lon_depart BETWEEN ? AND ?
             AND pente_moy_pct >= ?"""
    params = [lat - dlat, lat + dlat, lon - dlon, lon + dlon, pente_min]
    if types:
        sql += f" AND type_voie IN ({','.join('?' * len(types))})"
        params += list(types)
    resultats = []
    for ligne in con.execute(sql, params):
        d = distance_m(lat, lon, ligne["lat_depart"], ligne["lon_depart"])
        if d <= rayon_m:
            r = dict(ligne)
            for k in ("pentes_50m", "profil", "geometrie"):
                r[k] = json.loads(r[k])
            r["distance_m"] = round(d)
            resultats.append(r)
    return sorted(resultats, key=lambda r: r["distance_m"])[:limite]
