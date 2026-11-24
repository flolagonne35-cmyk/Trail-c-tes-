import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CORPS_DEFAUT, corpsPour, couleurZone, imc, lireCorps, morphoser, poidsCibles, reglagesMakeHuman, troisNiveaux } from "./corps.ts";

test("trois niveaux, comme MakeHuman", () => {
  assert.deepEqual(troisNiveaux(0.5), { min: 0, average: 1, max: 0 });
  assert.deepEqual(troisNiveaux(0), { min: 1, average: 0, max: 0 });
  assert.deepEqual(troisNiveaux(0.75), { min: 0, average: 0.5, max: 0.5 });
});

test("des chiffres réels aux réglages : IMC, taille", () => {
  const homme = corpsPour("homme");
  assert.ok(Math.abs(imc(homme) - 22.1) < 0.1);
  const r = reglagesMakeHuman(homme);
  assert.equal(r.genre, 1);
  assert.ok(Math.abs(r.poids - 0.5) < 0.02 && r.taille === 0.5);
  assert.ok(reglagesMakeHuman({ ...homme, poidsKg: 95 }).poids > 0.75); // IMC 30
  assert.ok(reglagesMakeHuman({ ...homme, tailleCm: 190 }).taille > 0.7);
});

test("les poids des cibles d'un genre somment à 1, l'autre genre à 0", () => {
  const noms = ["female", "male"].flatMap((g) => ["min", "average", "max"].flatMap((m) => ["min", "average", "max"].map((w) => `${g}-${m}muscle-${w}weight`)));
  const p = poidsCibles({ ...CORPS_DEFAUT, morpho: "puissante", poidsKg: 64 }, noms);
  assert.ok(Math.abs(p.slice(0, 9).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(p.slice(9).reduce((a, b) => a + b, 0), 0);
});

test("habillage : short à mi-cuisse, collant jusqu'à la cheville, t-shirt sur le haut du bras", () => {
  const c = { ...CORPS_DEFAUT, haut: "tshirt" as const, bas: "short" as const };
  assert.notEqual(couleurZone("cuisse_haut", c), couleurZone("cuisse_bas", c));
  assert.equal(couleurZone("mollet_haut", { ...c, bas: "collant" }), couleurZone("hanches", c));
  assert.equal(couleurZone("bras_haut", c), couleurZone("torse_bas", c));
});

test("le fichier du corps se lit et se déforme (si présent)", () => {
  let tampon: ArrayBuffer;
  try {
    const b = readFileSync(new URL("../../public/avatar/corps.bin", import.meta.url));
    tampon = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  } catch {
    return; // fichier pas encore généré
  }
  const d = lireCorps(tampon);
  assert.equal(d.cibles.length, 22);
  assert.equal(d.positions.length, d.sommets * 3);
  assert.ok(Math.max(...d.indices) < d.sommets);
  const hauteur = (pos: Float32Array) => { let a = Infinity, b = -Infinity; for (let i = 1; i < pos.length; i += 3) { a = Math.min(a, pos[i]); b = Math.max(b, pos[i]); } return b - a; };
  const petit = morphoser(d, poidsCibles({ ...CORPS_DEFAUT, tailleCm: 150 }, d.nomsCibles));
  const grand = morphoser(d, poidsCibles({ ...CORPS_DEFAUT, tailleCm: 185 }, d.nomsCibles));
  assert.ok(hauteur(grand) > hauteur(petit) * 1.05, `${hauteur(petit)} → ${hauteur(grand)}`);
});
