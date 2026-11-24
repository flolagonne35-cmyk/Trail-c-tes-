// Pose du coureur : le squelette simplifié de MakeHuman (19 os, voir scripts/avatar_corps.py) et
// un cycle de course, appliqués au corps par « skinning » linéaire (chaque sommet suit ses 4 os
// les plus proches, avec les poids de MakeHuman).
//
// Le cycle de course reprend les amplitudes articulaires mesurées en course à pied d'endurance
// (Novacheck 1998, « The biomechanics of running », Gait & Posture 7:77-95) : hanche d'environ
// 15° en extension à 45° en flexion, genou fléchi d'environ 20° à l'appui et jusqu'à 90-100° au
// retour de la jambe, coude autour de 90°, bras en opposition des jambes, buste un peu penché en avant.

import * as THREE from "three";

import type { DonneesCorps } from "./corps.ts";

export type Pose = "debout" | "course";

type Rotation = { os: string; axe: THREE.Vector3; angle: number };
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Axe de flexion du coude (perpendiculaire au bras et à l'avant-bras), calculé sur le corps réglé. */
function axeCoude(d: DonneesCorps, pivots: Float32Array, cote: "G" | "D"): THREE.Vector3 {
  const p = (nom: string) => { const i = d.os.findIndex((o) => o.nom === nom); return new THREE.Vector3(pivots[i * 3], pivots[i * 3 + 1], pivots[i * 3 + 2]); };
  const epaule = p(`bras${cote}`), coude = p(`avantbras${cote}`), poignet = p(`main${cote}`);
  return epaule.clone().sub(coude).negate().cross(poignet.clone().sub(coude)).normalize();
}

/**
 * Rotations de chaque os (dans le repère du corps au repos), pour une pose et un instant du cycle
 * (`phase` en radians : 0 = jambe gauche à mi-chemin vers l'avant, π/2 = jambe gauche devant).
 */
export function rotationsPose(d: DonneesCorps, pivots: Float32Array, pose: Pose, phase = Math.PI / 2): Rotation[] {
  const r: Rotation[] = [];
  for (const [cote, signe] of [["G", 1], ["D", -1]] as const) {
    // bras le long du corps (au repos, MakeHuman a les bras écartés en « A »)
    r.push({ os: `bras${cote}`, axe: Z, angle: -signe * 0.62 });
    r.push({ os: `cuisse${cote}`, axe: Z, angle: -signe * 0.08 });
    if (pose === "debout") {
      r.push({ os: `avantbras${cote}`, axe: axeCoude(d, pivots, cote), angle: -0.35 });
      continue;
    }
    const ph = cote === "G" ? phase : phase + Math.PI;
    const s = Math.sin(ph), c = Math.cos(ph);
    r.push({ os: `cuisse${cote}`, axe: X, angle: -(0.26 + 0.52 * s) });            // hanche : -15° à +45°
    r.push({ os: `jambe${cote}`, axe: X, angle: 0.35 + 1.2 * Math.max(0, c) ** 1.5 }); // genou : 20° à 90°
    r.push({ os: `pied${cote}`, axe: X, angle: -0.25 * Math.max(0, c) });
    r.push({ os: `bras${cote}`, axe: X, angle: 0.5 * s });                         // bras en opposition
    r.push({ os: `avantbras${cote}`, axe: axeCoude(d, pivots, cote), angle: 0.75 - 0.15 * s }); // coude ≈ 90°
  }
  if (pose === "course") {
    const s = Math.sin(phase);
    r.push({ os: "dos", axe: X, angle: 0.12 });       // buste penché d'environ 7°
    r.push({ os: "tete", axe: X, angle: -0.1 });      // regard devant
    r.push({ os: "bassin", axe: Y, angle: 0.07 * s }); // rotation du bassin
    r.push({ os: "poitrine", axe: Y, angle: -0.1 * s }); // et des épaules en sens inverse
  }
  return r;
}

/** Matrice de chaque os (repère du corps, décimètres) : parent × rotation autour du pivot. */
export function matricesOs(d: DonneesCorps, pivots: Float32Array, rotations: Rotation[]): THREE.Matrix4[] {
  const locales = d.os.map(() => new THREE.Quaternion());
  for (const rot of rotations) {
    const i = d.os.findIndex((o) => o.nom === rot.os);
    if (i >= 0) locales[i].premultiply(new THREE.Quaternion().setFromAxisAngle(rot.axe, rot.angle));
  }
  const res: THREE.Matrix4[] = [];
  d.os.forEach((o, i) => {
    const p = new THREE.Vector3(pivots[i * 3], pivots[i * 3 + 1], pivots[i * 3 + 2]);
    const m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(locales[i]))
      .multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    res.push(o.parent >= 0 ? res[o.parent].clone().multiply(m) : m); // les parents précèdent leurs enfants
  });
  return res;
}

/** Sommets posés : chaque sommet suit ses os, selon les poids (skinning linéaire). Renvoie le point le plus bas. */
export function poser(d: DonneesCorps, repos: Float32Array, matrices: THREE.Matrix4[], sortie: Float32Array): number {
  const e = matrices.map((m) => m.elements);
  let bas = Infinity;
  for (let i = 0; i < d.sommets; i++) {
    const x = repos[i * 3], y = repos[i * 3 + 1], z = repos[i * 3 + 2];
    let sx = 0, sy = 0, sz = 0;
    for (let k = 0; k < 4; k++) {
      const w = d.poidsOs[i * 4 + k];
      if (!w) continue;
      const m = e[d.osDe[i * 4 + k]];
      const f = w / 255;
      sx += f * (m[0] * x + m[4] * y + m[8] * z + m[12]);
      sy += f * (m[1] * x + m[5] * y + m[9] * z + m[13]);
      sz += f * (m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    sortie[i * 3] = sx; sortie[i * 3 + 1] = sy; sortie[i * 3 + 2] = sz;
    if (sy < bas) bas = sy;
  }
  return bas;
}
