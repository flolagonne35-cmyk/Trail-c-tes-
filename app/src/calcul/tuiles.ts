// Carte en tuiles (Web Mercator, tuiles de 256 px) : projection, tuiles visibles, zoom adapté.
// Fond : Plan IGN v2 (WMTS Géoplateforme, pyramide PM), Licence Ouverte. La version de test sans
// réseau charge des tuiles publiées avec la page (EXPO_PUBLIC_TUILES_LOCALES=1, zooms 11 à 15).

import type { Position } from "./geo.ts";

export const TAILLE = 256;
const R = 6378137;

export type Source = { url: (z: number, x: number, y: number) => string; zMin: number; zMax: number };

export const SOURCE_IGN: Source = {
  url: (z, x, y) => "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
    "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM" +
    `&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  zMin: 5,
  zMax: 18,
};

export const SOURCE_LOCALE: Source = { url: (z, x, y) => `tuiles/${z}/${x}/${y}.png`, zMin: 11, zMax: 15 };

/** Coordonnées en pixels « monde » au zoom z. */
export function versPixel(p: Position, z: number): [number, number] {
  const n = TAILLE * 2 ** z;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return [((p.lon + 180) / 360) * n, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n];
}

export function versPosition(px: number, py: number, z: number): Position {
  const n = TAILLE * 2 ** z;
  const lon = (px / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / n))) * 180) / Math.PI;
  return { lat, lon };
}

/** Mètres au sol par pixel d'écran. */
export function metresParPixel(lat: number, z: number): number {
  return (2 * Math.PI * R * Math.cos((lat * Math.PI) / 180)) / (TAILLE * 2 ** z);
}

export type TuileVisible = { cle: string; zxy: [number, number, number]; url: string; gauche: number; haut: number; taille: number };

/**
 * Tuiles couvrant un cadre `largeur` × `hauteur` centré sur `centre` au zoom `z`. Au-delà du zoom
 * maximal de la source, les tuiles du dernier niveau sont agrandies.
 */
export function tuilesVisibles(centre: Position, z: number, largeur: number, hauteur: number, source: Source): TuileVisible[] {
  const zs = Math.min(Math.max(z, source.zMin), source.zMax);
  const echelle = 2 ** (z - zs);
  const taille = TAILLE * echelle;
  const [cx, cy] = versPixel(centre, z);
  const x0 = cx - largeur / 2;
  const y0 = cy - hauteur / 2;
  const n = 2 ** zs;
  const tuiles: TuileVisible[] = [];
  for (let tx = Math.floor(x0 / taille); tx <= Math.floor((x0 + largeur) / taille); tx++) {
    for (let ty = Math.floor(y0 / taille); ty <= Math.floor((y0 + hauteur) / taille); ty++) {
      if (ty < 0 || ty >= n) continue;
      const xs = ((tx % n) + n) % n;
      tuiles.push({ cle: `${zs}/${xs}/${ty}`, zxy: [zs, xs, ty], url: source.url(zs, xs, ty), gauche: tx * taille - x0,
                    haut: ty * taille - y0, taille });
    }
  }
  return tuiles;
}

/** Position à l'écran (pixels depuis le coin haut-gauche du cadre) d'un point. */
export function surEcran(p: Position, centre: Position, z: number, largeur: number, hauteur: number): [number, number] {
  const [px, py] = versPixel(p, z);
  const [cx, cy] = versPixel(centre, z);
  return [px - cx + largeur / 2, py - cy + hauteur / 2];
}

/** Plus grand zoom (borné) auquel tous les points tiennent dans le cadre, marge comprise. */
export function zoomAjuste(points: Position[], largeur: number, hauteur: number, zMin = 11, zMax = 17, marge = 36): number {
  if (points.length < 2) return zMax - 1;
  for (let z = zMax; z > zMin; z--) {
    const px = points.map((p) => versPixel(p, z));
    const l = Math.max(...px.map((v) => v[0])) - Math.min(...px.map((v) => v[0]));
    const h = Math.max(...px.map((v) => v[1])) - Math.min(...px.map((v) => v[1]));
    if (l <= largeur - 2 * marge && h <= hauteur - 2 * marge) return z;
  }
  return zMin;
}

export function centreDe(points: Position[]): Position {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
}

/** Tuiles (z, x, y) couvrant un carré de `rayonM` autour de `centre`, du zoom zMin à zMax (carte hors ligne). */
export function tuilesZone(centre: Position, rayonM: number, zMin: number, zMax: number): [number, number, number][] {
  const dLat = rayonM / 111195;
  const dLon = rayonM / (111195 * Math.cos((centre.lat * Math.PI) / 180));
  const res: [number, number, number][] = [];
  for (let z = zMin; z <= zMax; z++) {
    const [x0, y0] = versPixel({ lat: centre.lat + dLat, lon: centre.lon - dLon }, z).map((v) => Math.floor(v / TAILLE));
    const [x1, y1] = versPixel({ lat: centre.lat - dLat, lon: centre.lon + dLon }, z).map((v) => Math.floor(v / TAILLE));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) res.push([z, x, y]);
  }
  return res;
}
