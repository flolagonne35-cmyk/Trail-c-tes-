/// <reference types="node" />
// Tests des calculs de l'application, et comparaison avec les scripts Python sur la même trace.
// Lancer : npm test (node --test, sans dépendance).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { analyserGpx } from "./parcours.ts";
import { lireGpx, ecrireGpx } from "./gpx.ts";
import { construirePlan, coutMinetti, lireObjectif, PREFERENCES_DEFAUT } from "./nutrition.ts";
import { cotesProches, type Cote } from "./cotes.ts";
import { lisser, pentesParTranche } from "./profil.ts";
import { distanceM } from "./geo.ts";

const fixture = (nom: string) => readFileSync(new URL(`./fixtures/${nom}`, import.meta.url), "utf8");

test("lissage gaussien : constant inchangé, moyenne conservée", () => {
  assert.deepEqual(lisser([5, 5, 5, 5], 2).map((v) => Math.round(v * 1e9) / 1e9), [5, 5, 5, 5]);
  const z = lisser([0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0], 1);
  assert.ok(Math.abs(z.reduce((a, b) => a + b, 0) - 10) < 1e-6 && z[5] < 10 && z[4] > 0);
});

test("pentes par tranche de 50 m", () => {
  const d = Array.from({ length: 51 }, (_, i) => i * 10);
  assert.deepEqual(pentesParTranche(d, d.map((x) => 0.1 * x)), Array(10).fill(10));
});

test("GPX : lecture, écriture, aller-retour", () => {
  const t = lireGpx(fixture("test.gpx"));
  assert.equal(t.nom, "Test");
  assert.equal(t.lat.length, 1101);
  const relu = lireGpx(ecrireGpx("A & B", [{ lat: 48.1, lon: -1.6, ele: 30 }, { lat: 48.2, lon: -1.7 }]));
  assert.deepEqual([relu.nom, relu.lat, relu.ele], ["A & B", [48.1, 48.2], [30, null]]);
});

test("segmentation identique au script Python sur la même trace", async () => {
  const ts = await analyserGpx(fixture("test.gpx"), { altitudes: null });
  const py = JSON.parse(fixture("parcours_python.json"));
  assert.equal(ts.segments.length, py.segments.length);
  ts.segments.forEach((s, i) => {
    const p = py.segments[i];
    assert.equal(s.type, p.type);
    assert.equal(s.difficulte, p.difficulte);
    assert.equal(s.description, p.description);
    assert.ok(Math.abs(s.km_debut - p.km_debut) <= 0.01, `km_debut ${s.km_debut} / ${p.km_debut}`);
    assert.ok(Math.abs(s.pente_moy_pct - p.pente_moy_pct) <= 0.1, `pente ${s.pente_moy_pct} / ${p.pente_moy_pct}`);
    assert.ok(Math.abs(s.dplus_m - p.dplus_m) <= 1);
  });
  assert.ok(Math.abs(ts.dplus_m - py.dplus_m) <= 1 && ts.distance_km === py.distance_km);
});

test("repli sur les altitudes du GPX si le service IGN échoue", async () => {
  const ts = await analyserGpx(fixture("test.gpx"), { altitudes: async () => { throw new Error("hors ligne"); } });
  assert.match(ts.source_altitudes, /repli/);
  assert.equal(ts.segments[1].type, "montée");
});

test("plan nutrition identique au script Python", async () => {
  const parcours = JSON.parse(fixture("parcours_python.json"));
  const py = JSON.parse(fixture("plan_python.json")).troncons;
  const ts = construirePlan(parcours, 1, [{ km: 3, nom: "Col" }], { ...PREFERENCES_DEFAUT, temperature: 25 });
  assert.equal(ts.length, py.length);
  ts.forEach((t, i) => {
    assert.equal(t.a, py[i].a);
    assert.ok(Math.abs(t.duree_h - py[i].duree_h) < 0.01);
    assert.deepEqual([t.gels, t.eau_l, t.pastilles_sel], [py[i].gels, py[i].eau_l, py[i].pastilles_sel]);
  });
});

test("Minetti et objectifs", () => {
  assert.ok(Math.abs(coutMinetti(0) - 3.6) < 1e-12);
  assert.ok(coutMinetti(0.1) / 3.6 > 1.6 && coutMinetti(-0.1) / 3.6 < 0.65);
  assert.equal(lireObjectif("38h"), 38);
  assert.ok(Math.abs(lireObjectif("5h40") - 5.6667) < 1e-3);
  assert.ok(Number.isNaN(lireObjectif("bientôt")));
});

test("côtes proches : filtres et tri par distance", () => {
  const base: Omit<Cote, "id" | "lat" | "lon" | "pente_moy_pct" | "type_voie"> = { longueur_m: 300, pente_max_pct: 9,
    dplus_m: 20, alt_depart_m: 0, alt_arrivee_m: 20, nom: "", revetement: "", technicite: "", pentes_50m: [],
    profil: { d: [], z: [] }, geometrie: [] };
  const cotes: Cote[] = [
    { ...base, id: 1, lat: 48.12, lon: -1.68, pente_moy_pct: 6, type_voie: "route" },
    { ...base, id: 2, lat: 48.112, lon: -1.68, pente_moy_pct: 9, type_voie: "sentier" },
    { ...base, id: 3, lat: 48.3, lon: -1.68, pente_moy_pct: 12, type_voie: "chemin" },
  ];
  const pos = { lat: 48.1113, lon: -1.68 };
  const tout = cotesProches(cotes, pos, { rayonM: 5000, penteMin: 0, types: ["route", "chemin", "sentier"] });
  assert.deepEqual(tout.map((c) => c.id), [2, 1]);
  assert.deepEqual(cotesProches(cotes, pos, { rayonM: 5000, penteMin: 8, types: ["route", "sentier"] }).map((c) => c.id), [2]);
  assert.ok(Math.abs(distanceM(pos, { lat: 48.1213, lon: -1.68 }) - 1112) < 2);
});

test("temps de passage : objectif tenu, côte plus lente que la descente", async () => {
  const { tempsDePassage } = await import("./nutrition.ts");
  const parcours = JSON.parse(fixture("parcours_python.json")); // 1 km plat, 2 km à 8 %, 1 km plat, 1,5 km à −10 %
  const p = tempsDePassage(parcours, 1, 1);
  assert.equal(p[p.length - 1].passage, "1 h 00");
  const allure = (s: string) => { const [m, sec] = s.split(":").map(Number); return m + sec / 60; };
  assert.ok(allure(p[1].allure) > allure(p[0].allure)); // km 2 (montée) plus lent que km 1 (plat)
  assert.ok(allure(p[5].allure) < allure(p[0].allure)); // dernier tronçon (descente) plus rapide
});
