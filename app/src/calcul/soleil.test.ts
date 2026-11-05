import assert from "node:assert/strict";
import test from "node:test";

import { soleil } from "./soleil.ts";

// Référence : Paris début novembre, lever ≈ 7 h 45 et coucher ≈ 17 h 20 (heure d'hiver, UTC+1) ;
// Rennes, plus à l'ouest, environ un quart d'heure plus tard. On tolère 6 minutes.
const minutes = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
test("lever et coucher du soleil à Paris et Rennes", () => {
  const p = soleil(new Date(2026, 10, 5), { lat: 48.857, lon: 2.352 })!;
  assert.ok(Math.abs(minutes(p.lever) - (6 * 60 + 45)) <= 6, `lever ${p.lever.toISOString()}`);
  assert.ok(Math.abs(minutes(p.coucher) - (16 * 60 + 20)) <= 6, `coucher ${p.coucher.toISOString()}`);
  const r = soleil(new Date(2026, 10, 5), { lat: 48.11, lon: -1.68 })!;
  assert.ok(minutes(r.coucher) - minutes(p.coucher) >= 10 && minutes(r.coucher) - minutes(p.coucher) <= 25);
});

test("solstice d'été : jours longs, nuit polaire au nord", () => {
  const s = soleil(new Date(2026, 5, 21), { lat: 48.11, lon: -1.68 })!;
  assert.ok(s.coucher.getTime() - s.lever.getTime() > 15.5 * 3600000);
  assert.equal(soleil(new Date(2026, 11, 21), { lat: 78, lon: 15 }), null);
});
