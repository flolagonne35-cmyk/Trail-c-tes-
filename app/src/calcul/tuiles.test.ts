/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { SOURCE_IGN, SOURCE_LOCALE, centreDe, metresParPixel, surEcran, tuilesVisibles, versPixel, versPosition, zoomAjuste } from "./tuiles.ts";

const MAIRIE = { lat: 48.1113, lon: -1.68 };

test("projection Web Mercator : aller-retour et tuile de Rennes", () => {
  const [x, y] = versPixel(MAIRIE, 15);
  // même numéro de tuile que scripts/telecharger_tuiles.py
  assert.deepEqual([Math.floor(x / 256), Math.floor(y / 256)], [16231, 11375]);
  const p = versPosition(x, y, 15);
  assert.ok(Math.abs(p.lat - MAIRIE.lat) < 1e-9 && Math.abs(p.lon - MAIRIE.lon) < 1e-9);
  assert.ok(Math.abs(metresParPixel(48.11, 15) - 3.19) < 0.01); // ≈ 3,2 m par pixel à Rennes
});

test("tuiles visibles et agrandissement au-delà du zoom de la source", () => {
  const t = tuilesVisibles(MAIRIE, 15, 390, 300, SOURCE_IGN);
  assert.ok(t.length >= 4 && t.length <= 6);
  assert.match(t[0].url, /TILEMATRIX=15&TILEROW=\d+&TILECOL=\d+/);
  assert.ok(t.every((x) => x.gauche > -256 && x.gauche < 390 && x.haut > -256 && x.haut < 300));
  const agrandies = tuilesVisibles(MAIRIE, 17, 390, 300, SOURCE_LOCALE);
  assert.ok(agrandies.every((x) => x.taille === 1024 && x.url.startsWith("tuiles/15/")));
});

test("point au centre du cadre, zoom ajusté", () => {
  assert.deepEqual(surEcran(MAIRIE, MAIRIE, 14, 390, 300), [195, 150]);
  const cote = [{ lat: 48.111, lon: -1.6745 }, { lat: 48.1135, lon: -1.6745 }]; // ≈ 280 m nord-sud
  const z = zoomAjuste(cote, 390, 220);
  assert.equal(z, 15, String(z)); // 280 m = 176 px au zoom 16 : dépasse 220 px moins les marges
  const loin = [MAIRIE, { lat: 48.15, lon: -1.6 }];
  assert.ok(zoomAjuste(loin, 390, 300) <= 13);
  const c = centreDe(cote);
  assert.ok(Math.abs(c.lat - 48.11225) < 1e-9);
});
