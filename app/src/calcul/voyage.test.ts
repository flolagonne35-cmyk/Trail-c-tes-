import assert from "node:assert/strict";
import test from "node:test";

import { coutVoiture, liens, lireOverpass, requeteOverpass, veille } from "./voyage.ts";

test("coût voiture : 300 km aller, 6,5 L/100, 1,70 €/L, à 3", () => {
  const c = coutVoiture(300000, 6.5, 1.7, 3);
  assert.equal(Math.round(c.litres), 39);
  assert.equal(Math.round(c.total * 100) / 100, 66.3);
  assert.equal(Math.round(c.parPersonne * 100) / 100, 22.1);
});

test("liens pré-remplis : la veille de la course", () => {
  assert.equal(veille("2027-03-01"), "2027-02-28");
  const l = liens("Rennes", "Millau", "2027-10-23");
  assert.match(l.covoiturage, /fn=Rennes&tn=Millau&db=2027-10-22/);
  assert.match(l.booking, /checkin=2027-10-22&checkout=2027-10-23/);
});

test("Overpass : logements nommés triés par distance, gares à part", () => {
  const depart = { lat: 44.1, lon: 3.08 };
  const r = lireOverpass({ elements: [
    { lat: 44.12, lon: 3.08, tags: { tourism: "hotel", name: "Hôtel du Tarn", stars: "3", website: "https://exemple.fr" } },
    { center: { lat: 44.101, lon: 3.081 }, tags: { tourism: "camp_site", name: "Camping des Rives" } },
    { lat: 44.1, lon: 3.09, tags: { tourism: "hotel" } }, // sans nom : écarté
    { lat: 44.098, lon: 3.077, tags: { railway: "station", name: "Millau" } },
  ] }, depart);
  assert.deepEqual(r.logements.map((x) => x.nom), ["Camping des Rives", "Hôtel du Tarn"]);
  assert.equal(r.logements[1].etoiles, 3);
  assert.equal(r.gares[0].nom, "Millau");
  assert.match(requeteOverpass(depart), /around:8000,44.1,3.08/);
});
