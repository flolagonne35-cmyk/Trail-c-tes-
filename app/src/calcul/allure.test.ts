// Allure par pente apprise des sorties, et prévision sur un parcours.

import { test } from "node:test";
import assert from "node:assert/strict";

import { allureLisible, alluresDeTrace, fusionner, modeleAllure, tempsPrevu } from "./allure.ts";
import { projection } from "./geo.ts";
import type { Parcours } from "./profil.ts";

const proj = projection(48.1, -1.68);

/** Trace plein nord : `km` sur le plat à 5:00 /km puis `kmMontee` à 10 % à 8:00 /km ; un point tous les 10 m. */
function trace(km: number, kmMontee: number) {
  const lat: number[] = [], lon: number[] = [], ele: number[] = [], temps: number[] = [];
  let t = 0;
  for (let y = 0; y <= (km + kmMontee) * 1000; y += 10) {
    const p = proj.latlon(0, y);
    lat.push(p.lat); lon.push(p.lon);
    const enMontee = y > km * 1000;
    ele.push(enMontee ? (y - km * 1000) * 0.1 : 0);
    temps.push(t);
    t += (enMontee ? 0.48 : 0.3) * 10 * 1000; // ms pour 10 m
  }
  return { lat, lon, ele, temps };
}

test("allure par tranche de pente, depuis un GPX horodaté", () => {
  const { lat, lon, ele, temps } = trace(3, 1);
  const a = alluresDeTrace(lat, lon, ele, temps);
  const [mPlat, sPlat] = a["0"];
  const [mMontee, sMontee] = a["10"];
  assert.ok(Math.abs(mPlat - 3000) < 120 && Math.abs(mMontee - 1000) < 120, JSON.stringify(a));
  assert.equal(allureLisible(sPlat / mPlat), "5:00");
  assert.ok(Math.abs((sMontee / mMontee) * 1000 - 480) <= 3); // 8:00 /km, à la fenêtre de transition près
});

test("modèle : tranches mesurées telles quelles, les autres par Minetti recalé ; prévision d'un parcours", () => {
  const { lat, lon, ele, temps } = trace(3, 1);
  const m = modeleAllure(fusionner([alluresDeTrace(lat, lon, ele, temps), undefined]))!;
  assert.deepEqual(m.connues, [0, 10]);
  assert.equal(allureLisible(m.secondesParMetre(0)), "5:00");
  assert.ok(Math.abs(m.secondesParMetre(10) * 1000 - 480) <= 3);
  assert.ok(m.secondesParMetre(20) > m.secondesParMetre(10)); // estimée, plus lente
  assert.ok(m.secondesParMetre(-5) < m.secondesParMetre(0)); // légère descente : plus vite
  // parcours : 2 km plat + 1 km à 10 % → 10 min + 8 min
  const parcours = { distance_km: 3, profil: { d_km: [0, 2, 3], z_m: [0, 0, 100] } } as unknown as Parcours;
  assert.ok(Math.abs(tempsPrevu(parcours, m) * 60 - 18) < 0.5, String(tempsPrevu(parcours, m) * 60));
  assert.equal(modeleAllure({}), null);
});
