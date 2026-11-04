// Liste des fichiers gardés hors connexion : mêmes règles que les chargements en ligne.

import { test } from "node:test";
import assert from "node:assert/strict";

import { tailleLisible, urlsZone } from "./horsLigne.ts";

const centre = { lat: 48.11, lon: -1.68 };
const idxCotes = { departements: {
  "35": { emprise: [47.6, -2.3, 48.7, -1.0], nombre: 10, fichiers: ["cotes_35.json", "cotes_35_2.json"] },
  "06": { emprise: [43.5, 6.6, 44.4, 7.7], nombre: 10, fichiers: ["cotes_06.json"] },
} };
const idxReseau = { blocs: [{ f: "reseau_35_1_2.json", e: [48.0, -1.8, 48.1, -1.6], n: 9 },
                            { f: "reseau_06_9_9.json", e: [43.6, 7.0, 43.7, 7.2], n: 9 }] };

test("zone gardée : côtes, réseau, points d'eau et carte autour du départ, sans doublon", () => {
  const u = urlsZone(centre, idxCotes, idxReseau);
  assert.ok(u.includes("/cotes/index.json") && u.includes("/cotes/cotes_35_2.json") && !u.includes("/cotes/cotes_06.json"));
  assert.ok(u.includes("/reseau/reseau_35_1_2.json") && !u.includes("/reseau/reseau_06_9_9.json"));
  assert.ok(u.includes("/eau/eau_48_-2.json"));
  const tuiles = u.filter((x) => x.includes("data.geopf.fr"));
  assert.ok(tuiles.length > 500 && tuiles.length < 1200 && tuiles.some((x) => x.includes("TILEMATRIX=16&")));
  assert.equal(u.length, new Set(u).size);
  assert.deepEqual(urlsZone(centre, null, null).filter((x) => x.startsWith("/cotes") || x.startsWith("/reseau")), []);
});

test("tailles lisibles", () => {
  assert.equal(tailleLisible(48_200_000), "48 Mo");
  assert.equal(tailleLisible(850_000), "850 ko");
});
