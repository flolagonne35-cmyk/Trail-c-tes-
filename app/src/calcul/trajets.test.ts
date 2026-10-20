/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { lireAdresse, lireItineraire, lireRecherche } from "./geoservices.ts";
import { dureeLisible, tempsTrajets } from "./trajets.ts";

// format de la Base Adresse Nationale (GeoJSON), repris par le géocodage de la Géoplateforme
const RECHERCHE = {
  type: "FeatureCollection",
  features: [
    { geometry: { type: "Point", coordinates: [-1.6743, 48.1147] },
      properties: { label: "12 Rue Gambetta 35000 Rennes", postcode: "35000", city: "Rennes", type: "housenumber" } },
    { geometry: { type: "Point", coordinates: [-1.68, 48.11] },
      properties: { label: "Rennes", postcode: "35000", city: "Rennes", type: "municipality" } },
    { geometry: { type: "Point", coordinates: [] }, properties: { label: "sans position" } },
  ],
};

test("géocodage : recherche et adresse", () => {
  const lieux = lireRecherche(RECHERCHE);
  assert.equal(lieux.length, 2);
  assert.deepEqual(lieux[0], { lat: 48.1147, lon: -1.6743, label: "12 Rue Gambetta 35000 Rennes", detail: "" });
  assert.equal(lieux[1].detail, "35000 Rennes");
  assert.equal(lireAdresse(RECHERCHE), "12 Rue Gambetta 35000 Rennes");
  assert.equal(lireAdresse({ features: [] }), null);
});

test("itinéraire : distance et durée", () => {
  assert.deepEqual(lireItineraire({ distance: 2350.4, duration: 6.2 }), { distance_m: 2350.4, duree_min: 6.2 });
  assert.equal(lireItineraire({ distance: "?" }), null);
});

test("temps de trajet : calculés si les itinéraires sont là, estimés sinon", () => {
  const a = { lat: 48.1113, lon: -1.68 };
  const b = { lat: 48.1203, lon: -1.68 }; // 1 km au nord
  const estimes = tempsTrajets(a, b, 5.5);
  assert.ok(estimes.every((t) => t.estime || t.mode !== "velo"));
  const course = estimes.find((t) => t.mode === "course")!;
  assert.ok(Math.abs(course.distance_m - 1300) < 5 && course.minutes === 7); // 1,3 km à 5:30
  const calcules = tempsTrajets(a, b, 5, { distance_m: 1800, duree_min: 4 }, { distance_m: 1200, duree_min: 16 });
  assert.deepEqual(calcules.map((t) => [t.mode, t.minutes, t.estime]),
                   [["voiture", 4, false], ["course", 6, false], ["marche", 16, false], ["velo", 5, true]]);
  assert.equal(dureeLisible(75), "1 h 15");
});
