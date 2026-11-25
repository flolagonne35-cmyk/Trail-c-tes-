import assert from "node:assert/strict";
import test from "node:test";

import { cotePlausible } from "./cotes.ts";

test("côtes au profil impossible écartées (altitudes fausses au-dessus de l'eau)", () => {
  const ok = { pente_moy_pct: 8.5, pente_max_pct: 14, dplus_m: 34, longueur_m: 400, profil: { d: [0, 400], z: [12, 46] } };
  assert.ok(cotePlausible(ok));
  // cas réel du 25/11 à Arzal : « 170 m à 33 122,5 % », +56 308 m
  assert.ok(!cotePlausible({ pente_moy_pct: 33122.5, pente_max_pct: 55384, dplus_m: 56308, longueur_m: 170, profil: { d: [0, 170], z: [-56302, 5.8] } }));
  assert.ok(!cotePlausible({ ...ok, profil: { d: [0, 400], z: [-800, 46] } }));
  assert.ok(!cotePlausible({ ...ok, pente_max_pct: 75 }));
});
