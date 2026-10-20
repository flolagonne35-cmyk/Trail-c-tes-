/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { chercherCommunes, indexer, normaliser, type Commune } from "./communes.ts";

// extrait au format de app/assets/data/communes.json (trié par population)
const COMMUNES: Commune[] = [
  ["Rennes", "35000", "35", 48.1116, -1.6819, 222485],
  ["Saint-Malo", "35400", "35", 48.6493, -2.0257, 46803],
  ["Couëron", "44220", "44", 47.2382, -1.7247, 23271],
  ["Cesson-Sévigné", "35510", "35", 48.1211, -1.6034, 18069],
  ["Saint-Jacques-de-la-Lande", "35136", "35", 48.0856, -1.7236, 13823],
  ["L'Haÿ-les-Roses", "94240", "94", 48.7797, 2.3378, 31000],
  ["Coueron-sur-Mer", "00000", "00", 0, 0, 1], // homonyme fictif, moins peuplé
];
const idx = indexer(COMMUNES);

test("normalisation : accents, tirets, apostrophes, saint", () => {
  assert.equal(normaliser("Couëron"), "coueron");
  assert.equal(normaliser("Couéron"), "coueron");
  assert.equal(normaliser("Saint-Jacques-de-la-Lande"), "st jacques de la lande");
  assert.equal(normaliser("L'Haÿ-les-Roses"), "l hay les roses");
});

test("« Couéron » trouve Couëron, devant l'homonyme moins peuplé", () => {
  const r = chercherCommunes("Couéron", idx);
  assert.deepEqual(r.map((l) => l.label), ["Couëron", "Coueron-sur-Mer"]);
  assert.equal(r[0].detail, "44220 · département 44");
  assert.ok(Math.abs(r[0].lat - 47.2382) < 1e-9);
});

test("début de mot, abréviation St, code postal", () => {
  assert.equal(chercherCommunes("sevigne", idx)[0].label, "Cesson-Sévigné");
  assert.equal(chercherCommunes("St Jacques", idx)[0].label, "Saint-Jacques-de-la-Lande");
  assert.equal(chercherCommunes("saint malo", idx)[0].label, "Saint-Malo");
  assert.equal(chercherCommunes("malo st", idx)[0].label, "Saint-Malo");
  assert.deepEqual(chercherCommunes("355", idx).map((l) => l.label), ["Cesson-Sévigné"]);
  assert.deepEqual(chercherCommunes("r", idx), []);
});
