import assert from "node:assert/strict";
import test from "node:test";

import { allureLisible, lireAllure, lireTemps, riegel, tempsLisible, vitesseDe } from "./allures.ts";

test("allure ↔ vitesse", () => {
  assert.equal(vitesseDe(lireAllure("4:00")), 15);
  assert.equal(allureLisible(lireAllure("4'30")), "4:30");
});

test("lecture des temps", () => {
  assert.equal(lireTemps("45:30"), 45.5);
  assert.equal(lireTemps("1:30:00"), 90);
  assert.equal(lireTemps("3h05"), 185);
});

test("Riegel : 40 min au 10 km ≈ 1 h 28 au semi", () => {
  const semi = riegel(40, 10, 21.0975);
  assert.equal(tempsLisible(semi), "1:28:15");
});
