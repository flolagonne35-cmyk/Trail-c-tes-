// Départements à charger autour du départ, et fusion avec les côtes embarquées.

import { test } from "node:test";
import assert from "node:assert/strict";

import { emprisesProches, fusionnerCotes, type IndexDepartements } from "./departements.ts";
import type { Cote } from "./cotes.ts";

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

test("fusion : les côtes embarquées d'un département chargé ne sont pas en double", () => {
  const c = (id: number, lat: number, lon: number) => ({ id, lat, lon }) as Cote;
  const r = fusionnerCotes([c(35000001, 48.1, -1.7)], [[47.6, -2.3, 48.7, -1.0]], [c(1, 48.1, -1.7), c(2, 47.2, -1.75)]);
  assert.deepEqual(r.map((x) => x.id), [35000001, 2]);
});
