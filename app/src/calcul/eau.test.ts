// Points d'eau sur le parcours : km de passage, marge de détour, cases chargées.

import { test } from "node:test";
import assert from "node:assert/strict";

import { casesAutour, eauPresDesCotes, eauSurParcours, libelleEau, lirePoints, type FichierEau } from "./eau.ts";

// tracé droit vers l'est sur ≈ 2 km, à 48,1° N
const trace = Array.from({ length: 21 }, (_, i) => ({ lat: 48.1, lon: -1.7 + i * 0.00134 }));

const fichier: FichierEau = { source: "© OSM", types: ["fontaine", "point d'eau", "robinet"], points: [
  [-169000, 4810050, 0, "Fontaine du parc", "oui", "2025-06-01"], // ≈ 0,75 km, 55 m au nord
  [-168000, 4810000, 2, "", "", ""],                             // ≈ 1,5 km, sur le tracé
  [-169500, 4812000, 0, "Trop loin", "", ""],                     // 220 m : détour trop long
] };

test("points d'eau triés par km, sans ceux trop loin du tracé", () => {
  const r = eauSurParcours(lirePoints(fichier), trace);
  assert.deepEqual(r.map((e) => e.nom), ["Fontaine du parc", ""]);
  assert.ok(Math.abs(r[0].km - 0.75) < 0.05 && Math.abs(r[0].ecart_m - 56) <= 2);
  assert.ok(Math.abs(r[1].km - 1.49) < 0.05 && r[1].ecart_m === 0);
  assert.equal(libelleEau(r[0]), "Fontaine du parc (fontaine) · saisonnier, souvent coupé l'hiver · vérifié en 2025-06");
  assert.equal(libelleEau(r[1]), "Robinet");
});

test("cases de 1° autour du tracé", () => {
  assert.deepEqual(casesAutour(trace), ["48_-2"]);
  assert.deepEqual(casesAutour([{ lat: 47.995, lon: -1.005 }]).sort(), ["47_-1", "47_-2", "48_-1", "48_-2"]);
});

test("points d'eau près du pied ou du sommet des côtes", () => {
  const pts = lirePoints(fichier);
  // pied à ≈ 110 m au nord de la fontaine, sommet sur le robinet
  const cote = { lat: 48.1015, lon: -1.69, geometrie: [[-1.69, 48.1015], [-1.68, 48.1]] as [number, number][] };
  assert.deepEqual(eauPresDesCotes(pts, [cote]).map((e) => e.type), ["robinet", "fontaine"]); // le plus proche d'abord
  assert.deepEqual(eauPresDesCotes(pts, [cote], 50).map((e) => e.type), ["robinet"]);
});
