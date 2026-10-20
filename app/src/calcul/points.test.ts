/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import type { Cote } from "./cotes.ts";
import { projection } from "./geo.ts";
import { ecrireGpx } from "./gpx.ts";
import { activiteDepuisGpx, activiteDepuisPhoto, BAREME, denivelePositif, score, type Activite } from "./points.ts";

const proj = projection(48.11, -1.68);
const pt = (y: number) => proj.latlon(0, y);

// côte de 300 m vers le nord, +24 m
const cote: Cote = {
  id: 7, lat: 48.11, lon: -1.68, longueur_m: 300, pente_moy_pct: 8, pente_max_pct: 10, dplus_m: 24,
  alt_depart_m: 50, alt_arrivee_m: 74, type_voie: "chemin", nom: "Côte test", revetement: "", technicite: "",
  pentes_50m: [8], profil: { d: [0, 300], z: [50, 74] }, geometrie: [[-1.68, 48.11], [pt(300).lon, pt(300).lat]],
};

/** Approche de 200 m, puis `reps` allers-retours sur la côte ; un point tous les 10 m. */
function sortie(reps: number, debut: number, secondesPar10m = 4) {
  const ys: number[] = [];
  for (let y = -200; y < 0; y += 10) ys.push(y);
  for (let r = 0; r < reps; r++) {
    for (let y = 0; y <= 300; y += 10) ys.push(y);
    for (let y = 290; y > 0; y -= 10) ys.push(y);
  }
  ys.push(0);
  return ecrireGpx("Séance côtes", ys.map((y, i) => ({ ...pt(y), ele: 50 + Math.max(0, y) * 0.08,
                                                       temps: debut + i * secondesPar10m * 1000 })));
}

const CREATION = "2026-10-01T00:00:00Z";
const APRES = Date.parse("2026-10-10T08:00:00Z");

test("compte les montées complètes d'une côte connue", () => {
  const a = activiteDepuisGpx(sortie(3, APRES), [cote], CREATION, []);
  assert.equal(a.statut, "validee");
  assert.deepEqual(a.repetitions.map((r) => [r.cote_id, r.n]), [[7, 3]]);
  // 3 × 600 m + 200 m ≈ 2 km, D+ 3 × 24 m = 72 m, 3 montées × 5 points (24 m / 5)
  assert.ok(Math.abs(a.distance_km - 1.99) < 0.05, String(a.distance_km));
  assert.ok(Math.abs(a.dplus_m - 72) <= 3, String(a.dplus_m));
  assert.equal(a.points, Math.round(a.distance_km + a.dplus_m / 10 + 3 * 5));
});

test("refuse : avant la création du compte, doublon, vélo, sans horodatage", () => {
  const avant = activiteDepuisGpx(sortie(1, Date.parse("2026-09-01T08:00:00Z")), [cote], CREATION, []);
  assert.equal(avant.statut, "refusee");
  assert.match(avant.motif ?? "", /antérieure/);
  const a = activiteDepuisGpx(sortie(1, APRES), [cote], CREATION, []);
  assert.match(activiteDepuisGpx(sortie(1, APRES), [cote], CREATION, [a.empreinte]).motif ?? "", /déjà/);
  assert.match(activiteDepuisGpx(sortie(2, APRES, 1), [cote], CREATION, []).motif ?? "", /vélo/); // 36 km/h
  const sansHeure = ecrireGpx("x", [pt(0), pt(100)]);
  assert.match(activiteDepuisGpx(sansHeure, [cote], CREATION, []).motif ?? "", /horodatage/);
});

test("capture d'écran : points en attente, refus si antérieure", () => {
  const p = activiteDepuisPhoto({ date: "2026-10-12T07:00:00Z", distance_km: 21.1, dplus_m: 450, photo: "x" }, CREATION);
  assert.equal(p.statut, "en_attente");
  assert.equal(p.points, Math.round(21.1 + 45));
  assert.equal(activiteDepuisPhoto({ date: "2026-09-12T07:00:00Z", distance_km: 10, dplus_m: 0, photo: "x" }, CREATION).statut, "refusee");
});

test("score : seules les sorties validées comptent, distance plafonnée par semaine", () => {
  const a = (km: number, statut: Activite["statut"], date = "2026-10-12T07:00:00Z"): Activite => ({
    id: `${km}${statut}${date}`, date, source: "gpx", statut, nom: "", distance_km: km, dplus_m: 0, duree_min: null,
    repetitions: [], points: km, empreinte: "",
  });
  assert.deepEqual(score([a(10, "validee"), a(5, "en_attente"), a(8, "refusee")]), { valides: 10, enAttente: 5 });
  const s = score([a(200, "validee"), a(100, "validee", "2026-10-13T07:00:00Z")]);
  assert.equal(s.valides, BAREME.plafondKmSemaine);
});

test("D+ sans bruit", () => {
  assert.equal(denivelePositif([10, 11, 10, 11, 10, 11]), 0);
  assert.equal(denivelePositif([10, 20, 15, 30, null, 25]), 25);
});
