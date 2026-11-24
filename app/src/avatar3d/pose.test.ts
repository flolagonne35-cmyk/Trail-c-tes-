import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as THREE from "three";

import { CORPS_DEFAUT, lireCorps, morphoser, pivotsMorphoses, poidsCibles } from "./corps.ts";
import { matricesOs, poser, rotationsPose } from "./pose.ts";

const b = readFileSync(new URL("../../public/avatar/corps.bin", import.meta.url));
const d = lireCorps(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const w = poidsCibles(CORPS_DEFAUT, d.nomsCibles);
const repos = morphoser(d, w);
const pivots = pivotsMorphoses(d, w);
const pos = (m: THREE.Matrix4[], nom: string) => {
  const i = d.os.findIndex((o) => o.nom === nom);
  return new THREE.Vector3(pivots[i * 3], pivots[i * 3 + 1], pivots[i * 3 + 2]).applyMatrix4(m[i]);
};

test("squelette : 19 os, poids de chaque sommet sur 255", () => {
  assert.equal(d.os.length, 19);
  for (let i = 0; i < d.sommets; i += 97) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += d.poidsOs[i * 4 + k];
    assert.equal(s, 255);
  }
});

test("pose de course : jambe gauche devant et bras gauche derrière, mains près du corps", () => {
  const m = matricesOs(d, pivots, rotationsPose(d, pivots, "course", Math.PI / 2));
  assert.ok(pos(m, "piedG").z > pos(m, "piedD").z + 1, "pied gauche devant");
  assert.ok(pos(m, "mainG").z < pos(m, "mainD").z, "bras gauche en arrière");
  for (const main of ["mainG", "mainD"]) {
    const p = pos(m, main);
    assert.ok(Math.abs(p.x) < 2.6, `${main} près du corps (${p.x.toFixed(2)} dm)`);
    assert.ok(p.y > 0 && p.y < 4, `${main} à hauteur de taille (${p.y.toFixed(2)})`);
  }
  const sortie = new Float32Array(repos.length);
  const bas = poser(d, repos, m, sortie);
  assert.ok(Number.isFinite(bas) && sortie.every(Number.isFinite));
});

test("pose debout : sans rotation des jambes, le corps garde sa hauteur", () => {
  const m = matricesOs(d, pivots, []);
  const sortie = new Float32Array(repos.length);
  poser(d, repos, m, sortie);
  for (let i = 0; i < 300; i++) assert.ok(Math.abs(sortie[i] - repos[i]) < 1e-4);
});
