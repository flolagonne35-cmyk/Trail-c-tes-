// Départements à charger autour du départ.

import { test } from "node:test";
import assert from "node:assert/strict";

import { emprisesProches, type IndexDepartements } from "./departements.ts";

const idx: IndexDepartements = { departements: {
  "35": { emprise: [47.6, -2.3, 48.7, -1.0], nombre: 10, fichiers: ["cotes_35.json"] },
  "44": { emprise: [46.9, -2.6, 47.8, -0.9], nombre: 10, fichiers: ["cotes_44.json"] },
  "06": { emprise: [43.5, 6.6, 44.4, 7.7], nombre: 10, fichiers: ["cotes_06.json"] },
} };

test("départements autour du départ", () => {
  assert.deepEqual(emprisesProches(idx, { lat: 48.6, lon: -1.5 }, 40).sort(), ["35"]);
  assert.deepEqual(emprisesProches(idx, { lat: 47.75, lon: -1.6 }, 40).sort(), ["35", "44"]);
  assert.deepEqual(emprisesProches(idx, { lat: 45.0, lon: 2.0 }, 40), []);
});

