import assert from "node:assert/strict";
import test from "node:test";

import { circule, dernierJour, garesProches, heure, indiceJour, trainsDirects, type Passage, type Services } from "./horaires.ts";

// service 0 : tous les jours ; service 1 : le 2e jour seulement (28/11)
const S: Services = { debut: "2026-11-27", jours: 5, s: ["1f", "2"] };
const RENNES: Passage[] = [[0, 0, 425, 425, 0, 1, "8612"], [1, 0, 1430, 1430, 1, 0, "857000"], [2, 3, 600, 602, 0, 0, "857010"]];
const LAVAL: Passage[] = [[0, 1, 462, 464, 0, 1, "8612"], [1, 2, 1480, 1480, 1, 0, "857000"], [2, 1, 500, 500, 0, 0, "857010"]];

test("jours publiés et circulation", () => {
  assert.equal(indiceJour(S, "2026-11-28"), 1);
  assert.equal(indiceJour(S, "2027-06-01"), null);
  assert.equal(dernierJour(S), "2026-12-01");
  assert.ok(circule(S, 1, 1) && !circule(S, 1, 0));
});

test("trains directs : même train, bon sens, jour de circulation", () => {
  const t = trainsDirects(S, "2026-11-28", [{ nom: "Rennes", d: 900, passages: RENNES }], [{ nom: "Laval", d: 300, passages: LAVAL }]);
  // 857010 passe à Laval AVANT Rennes : sens inverse, écarté
  assert.deepEqual(t.map((x) => [x.numero, x.mode, x.depart, x.arrivee, x.duree]), [["8612", "TGV INOUI", 425, 462, 37], ["857000", "TER", 1430, 1480, 50]]);
  assert.equal(trainsDirects(S, "2026-11-29", [{ nom: "Rennes", d: 0, passages: RENNES }], [{ nom: "Laval", d: 0, passages: LAVAL }]).length, 1);
  assert.equal(heure(425), "7 h 05");
  // descente interdite à Laval : le train n'est pas proposé
  const sansDescente: Passage[] = LAVAL.map((p) => (p[6] === "8612" ? [p[0], p[1], p[2], p[3], p[4], p[5], p[6], 2] as Passage : p));
  assert.ok(!trainsDirects(S, "2026-11-28", [{ nom: "Rennes", d: 0, passages: RENNES }], [{ nom: "Laval", d: 0, passages: sansDescente }])
    .some((x) => x.numero === "8612"));
});

test("gares proches", () => {
  const g = garesProches([["1", "Rennes", 48.1035, -1.6722], ["2", "Laval", 48.0763, -0.7614]], { lat: 48.11, lon: -1.68 }, 40000);
  assert.deepEqual(g.map((x) => x.nom), ["Rennes"]);
});
