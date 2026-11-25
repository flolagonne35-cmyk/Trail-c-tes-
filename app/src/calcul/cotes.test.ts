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

test("tri sur plusieurs critères : raides ET longues devant", async () => {
  const { meilleures } = await import("./cotes.ts");
  const c = (id: number, pente: number, longueur: number) => ({ id, pente_moy_pct: pente, longueur_m: longueur, distance_m: id, dplus_m: 0, pente_max_pct: pente } as never);
  const cotes = [c(1, 20, 100), c(2, 8, 1600), c(3, 15, 1800), c(4, 5, 300)];
  const seule = meilleures(cotes, { tris: [{ cle: "pente", croissant: false }] } as never).map((x: { id: number }) => x.id);
  assert.deepEqual(seule, [1, 3, 2, 4]);
  const deux = meilleures(cotes, { tris: [{ cle: "pente", croissant: false }, { cle: "longueur", croissant: false }] } as never).map((x: { id: number }) => x.id);
  assert.equal(deux[0], 3); // 2e en pente, 1re en longueur : la meilleure des deux à la fois
});
