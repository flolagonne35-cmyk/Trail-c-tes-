"""Tests hors réseau de la préparation du corps 3D (scripts/avatar_corps.py)."""

import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import avatar_corps as ac  # noqa: E402


def test_distance_segment():
    d, t = ac.distance_segment((0, 1, 0), (0, 0, 0), (2, 0, 0))
    assert d == 1 and t == 0
    d, t = ac.distance_segment((1, 0, 0), (0, 0, 0), (2, 0, 0))
    assert d == 0 and t == 0.5


def test_lire_cible(tmp_path):
    f = tmp_path / "c.target"
    f.write_text("# commentaire\n3 0.1 -0.2 0.3\n\n7 0 0 1\n")
    assert ac.lire_cible(f) == {3: (0.1, -0.2, 0.3), 7: (0.0, 0.0, 1.0)}


def test_corps_bin_livre():
    """Le fichier livré avec l'appli a un en-tête cohérent avec ses données."""
    b = (Path(__file__).resolve().parents[1] / "app/public/avatar/corps.bin").read_bytes()
    (n,) = struct.unpack("<I", b[:4])
    h = json.loads(b[4:4 + n])
    assert h["zones"] == ac.ZONES
    assert len(h["cibles"]) == 22
    assert h["sommets"] > 10000 and h["triangles"] > 20000
