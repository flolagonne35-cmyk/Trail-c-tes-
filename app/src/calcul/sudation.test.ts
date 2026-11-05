import assert from "node:assert/strict";
import test from "node:test";

import { besoinsPersonnels, partPerdue, profilSel, tauxSudation, testPourTemperature, type TestSudation } from "./sudation.ts";

test("test de pesée : 1 h, 70 → 69,2 kg, 0,3 L bu = 1,1 L/h", () => {
  assert.equal(tauxSudation({ dureeH: 1, avantKg: 70, apresKg: 69.2, buL: 0.3 }), 1.1);
  assert.ok(Math.abs(partPerdue({ avantKg: 70, apresKg: 69.2 }) - 0.0114) < 0.001);
});

test("pesées incohérentes : refusées", () => {
  assert.equal(tauxSudation({ dureeH: 1, avantKg: 70, apresKg: 70.5, buL: 0 }), null); // a pris du poids
  assert.equal(tauxSudation({ dureeH: 0.2, avantKg: 70, apresKg: 69, buL: 0 }), null); // trop court
  assert.equal(tauxSudation({ dureeH: 1, avantKg: 70, apresKg: 65, buL: 0 }), null); // 5 L/h : erreur
});

test("profil de sel et besoins par heure", () => {
  assert.equal(profilSel(0), "peu");
  assert.equal(profilSel(1), "moyen");
  assert.equal(profilSel(3), "sale");
  // 1,1 L/h perdus → 0,75 L bus par heure ; sueur salée → 900 mg/L × 0,75 ≈ 700 mg
  assert.deepEqual(besoinsPersonnels(1.1, "sale"), { eau: 750, sodium: 700 });
  // jamais plus de 1 L/h ni moins de 0,3 L/h
  assert.equal(besoinsPersonnels(2.5, "moyen").eau, 1000);
  assert.equal(besoinsPersonnels(0.3, "peu").eau, 300);
});

test("on prend le test fait à la température la plus proche", () => {
  const t = (temperature: number, date: string): TestSudation => ({ date, dureeH: 1, avantKg: 70, apresKg: 69, buL: 0, temperature });
  assert.equal(testPourTemperature([t(10, "2026-03-01"), t(26, "2026-07-01")], 24)!.temperature, 26);
  assert.equal(testPourTemperature([], 20), null);
});
