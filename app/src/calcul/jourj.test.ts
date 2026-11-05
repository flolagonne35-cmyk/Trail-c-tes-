import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { conseil, feuilleJourJ, horloge, lireHeure, marges, materiel } from "./jourj.ts";
import type { Parcours, Segment } from "./profil.ts";

const parcours = JSON.parse(readFileSync(new URL("../../assets/data/parcours_demo.json", import.meta.url), "utf8")) as Parcours;

test("heures de l'horloge", () => {
  assert.equal(lireHeure("7h30"), 450);
  assert.equal(lireHeure("07:05"), 425);
  assert.ok(Number.isNaN(lireHeure("25h")));
  assert.equal(horloge(450, 2.5), "10 h 00");
  assert.equal(horloge(22 * 60, 5), "J+1 3 h 00");
});

test("la feuille couvre toute la course, l'arrivée tombe sur l'objectif", () => {
  const f = feuilleJourJ(parcours, 4, 7 * 60);
  assert.equal(f.length, parcours.segments.length);
  assert.ok(Math.abs(f.at(-1)!.arrivee_h - 4) < 0.02);
  assert.equal(f.at(-1)!.heure, "11 h 00");
  assert.ok(f.every((l) => l.conseil.length > 10));
});

test("conseils selon la pente et la place dans la course", () => {
  const s = (type: Segment["type"], pente: number, km: number) => ({ type, pente_moy_pct: pente, km_debut: km } as Segment);
  assert.match(conseil(s("montée", 15, 5), 50), /Marche active/);
  assert.match(conseil(s("descente", -10, 10), 80), /gestion/);
  assert.match(conseil(s("descente", -6, 70), 80), /Laisse rouler/);
});

test("barrières horaires : marge en minutes, limite après minuit", () => {
  const [m] = marges(parcours, 4, 7 * 60, [{ km: parcours.distance_km, heureMin: 12 * 60, nom: "Arrivée" }]);
  assert.ok(Math.abs(m.marge - 60) <= 1);
  const [n] = marges(parcours, 4, 22 * 60, [{ km: parcours.distance_km, heureMin: 3 * 60, nom: "Arrivée" }]);
  assert.ok(Math.abs(n.marge - 60) <= 1);
});

test("matériel : frontale la nuit, couverture en trail long", () => {
  assert.ok(materiel(parcours, 6, true).some((x) => x.startsWith("Frontale")));
  assert.ok(!materiel(parcours, 1, false).some((x) => x.startsWith("Frontale")));
});
