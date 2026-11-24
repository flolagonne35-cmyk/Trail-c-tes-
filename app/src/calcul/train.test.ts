import assert from "node:assert/strict";
import test from "node:test";

import { trainDirect, transporteurs, type Tarifs } from "./train.ts";

const T: Tarifs = {
  source: "test", date: "2026-11-24",
  gares: [["87471003", "Rennes", 48.1035, -1.6722], ["87478404", "Laval", 48.0763, -0.7614],
          ["87581009", "Bordeaux Saint-Jean", 44.8259, -0.5562], ["87391003", "Paris Montparnasse", 48.8412, 2.3203]],
  trajets: [[0, 1, 10, 59, 3], [0, 2, 25, 70, 4], [0, 3, 19, 99, 3]],
};

test("train direct : les gares les plus proches de chez soi et de la course", () => {
  const o = trainDirect(T, { lat: 48.11, lon: -1.68 }, { lat: 44.84, lon: -0.58 });
  assert.equal(o?.gareDepart, "Rennes");
  assert.equal(o?.gareArrivee, "Bordeaux Saint-Jean");
  assert.deepEqual([o?.prixMin, o?.prixMax], [25, 70]);
  assert.deepEqual(o?.transporteurs, ["Intercités"]);
  assert.ok((o?.accesArrivee_m ?? 1e9) < 5000);
});

test("un trajet vaut dans les deux sens", () => {
  const o = trainDirect(T, { lat: 48.84, lon: 2.32 }, { lat: 48.1, lon: -1.67 });
  assert.equal(o?.gareDepart, "Paris (gare selon le train)");
  assert.deepEqual(o?.transporteurs, ["TGV INOUI", "OUIGO"]);
});

test("pas de train direct, ou pas de gare à moins de 40 km : null", () => {
  assert.equal(trainDirect(T, { lat: 48.07, lon: -0.76 }, { lat: 44.83, lon: -0.55 }), null); // Laval → Bordeaux
  assert.equal(trainDirect(T, { lat: 45.9, lon: 6.1 }, { lat: 48.1, lon: -1.67 }), null); // Annecy : aucune gare listée
  assert.deepEqual(transporteurs(7), ["TGV INOUI", "OUIGO", "Intercités"]);
});
