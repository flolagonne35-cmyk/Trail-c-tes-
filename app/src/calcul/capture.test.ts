import assert from "node:assert/strict";
import test from "node:test";

import { extraireJson, lireActivite, lireProfil, profilReechantillonne } from "./capture.ts";

test("JSON entouré de texte, valeurs plausibles seulement", () => {
  const j = extraireJson('Voici :\n```json\n{"distance_km": "21,3", "dplus_m": 640, "duree_min": 128, "date": "2026-11-22", "titre": "Sortie longue"}\n```');
  assert.deepEqual(lireActivite(j!), { distance_km: 21.3, dplus_m: 640, duree_min: 128, date: "2026-11-22", titre: "Sortie longue" });
  assert.deepEqual(lireActivite({ distance_km: 9999, dplus_m: -5, date: "hier" }), { distance_km: null, dplus_m: null, duree_min: null, date: null, titre: null });
  assert.equal(extraireJson("pas de json"), null);
});

test("profil lu : points triés, ravitos et barrières, rééchantillonnage tous les 100 m", () => {
  const l = lireProfil({ distance_km: 2, dplus_m: 100, points: [[0, 200], [1, 300], [0.5, 250], [2, 200], [1.5, 260], ["x", 3]],
                         ravitos: [{ km: 1, nom: "Col" }], barrieres: [{ km: 1.5, heure: "10:30" }, { km: 2, heure: "midi" }] });
  assert.deepEqual(l.points, [[0, 200], [0.5, 250], [1, 300], [1.5, 260], [2, 200]]);
  assert.deepEqual(l.ravitos, [{ km: 1, nom: "Col" }]);
  assert.deepEqual(l.barrieres, [{ km: 1.5, heure: "10:30" }]);
  const r = profilReechantillonne(l)!;
  assert.equal(r.d_m.length, 21);
  assert.equal(r.z[10], 300);
  assert.equal(Math.round(r.z[5]), 250);
});

test("parcours depuis une capture : profil découpé, D+ annoncé conservé", async () => {
  const { parcoursDepuisCapture } = await import("./capture.ts");
  const p = parcoursDepuisCapture(lireProfil({ nom: "Trail test", distance_km: 10, dplus_m: 620,
    points: [[0, 300], [2, 320], [4, 700], [6, 690], [8, 350], [10, 300]] }))!;
  assert.equal(p.nom, "Trail test");
  assert.ok(Math.abs(p.distance_km - 10) < 0.05);
  assert.equal(p.dplus_m, 620);
  assert.ok(p.segments.some((s) => s.type === "montée") && p.segments.some((s) => s.type === "descente"));
});
