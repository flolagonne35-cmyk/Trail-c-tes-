// Réseau France : choix des blocs autour du départ et raccord des blocs voisins.

import { test } from "node:test";
import assert from "node:assert/strict";

import { blocsAutour, construireGraphe, fusionnerReseaux, rayonPourBoucle, type ReseauBrut } from "./reseau.ts";

const types = ["route", "chemin", "sentier", "piste cyclable", "liaison"];
const trafics = ["calme", "modéré", "passant"];
// deux blocs voisins qui partagent le carrefour (−168000, 4810000)
const ouest: ReseauBrut = { source: "", types, trafics, noms: ["Rue A"],
  noeuds: [[-168200, 4810000], [-168000, 4810000]], aretes: [[0, 1, 150, 2, 0, 0, 0, 0, []]] };
const est: ReseauBrut = { source: "", types, trafics, noms: ["Chemin B", "Rue A"],
  noeuds: [[-168000, 4810000], [-167800, 4810000]], aretes: [[0, 1, 150, 0, 3, 1, 0, 1, [-167900, 4810010]]] };

test("blocs voisins raccordés par leurs carrefours communs", () => {
  const r = fusionnerReseaux([ouest, est]);
  assert.equal(r.noeuds.length, 3);
  assert.deepEqual(r.aretes.map((a) => [a[0], a[1], a[7]]), [[0, 1, 0], [1, 2, 0]]); // même nom réutilisé
  assert.deepEqual(r.noms, ["Rue A"]);
  const g = construireGraphe(r);
  assert.equal(g.taille[0], 3); // une seule composante : on passe d'un bloc à l'autre
});

test("blocs chargés selon la distance de la boucle", () => {
  const idx = { blocs: [{ f: "pres.json", e: [48.0, -1.8, 48.1, -1.6], n: 10 },
                        { f: "loin.json", e: [48.25, -1.8, 48.35, -1.6], n: 10 }] };
  assert.deepEqual(blocsAutour(idx, { lat: 48.12, lon: -1.7 }, rayonPourBoucle(10)), ["pres.json"]);
  assert.deepEqual(blocsAutour(idx, { lat: 48.12, lon: -1.7 }, rayonPourBoucle(80)).sort(), ["loin.json", "pres.json"]);
  assert.equal(rayonPourBoucle(2), 3);
  assert.equal(rayonPourBoucle(200), 20);
});
