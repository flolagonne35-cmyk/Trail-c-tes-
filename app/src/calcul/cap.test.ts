import assert from "node:assert/strict";
import test from "node:test";

import { angleFleche, cap, consigne, pointCardinal } from "./cap.ts";

test("cap vers le nord, l'est, le sud-ouest", () => {
  const rennes = { lat: 48.11, lon: -1.68 };
  assert.ok(Math.abs(cap(rennes, { lat: 48.2, lon: -1.68 }) - 0) < 0.5);
  assert.ok(Math.abs(cap(rennes, { lat: 48.11, lon: -1.5 }) - 90) < 0.5);
  assert.equal(pointCardinal(cap(rennes, { lat: 48.05, lon: -1.77 })), "sud-ouest");
});

test("flèche et consigne selon l'orientation du téléphone", () => {
  assert.equal(angleFleche(90, 90), 0);
  assert.equal(consigne(angleFleche(90, 90)), "Droit devant");
  assert.equal(consigne(angleFleche(0, 90)), "À gauche");
  assert.match(consigne(180), /demi-tour/);
});
