// Géométrie : projection locale en mètres, interpolation, rééchantillonnage, distances.
// Port de trailcotes/geo.py.

export const RAYON_TERRE = 6_371_000;

export type Position = { lat: number; lon: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Équirectangulaire locale autour de (lat0, lon0), suffisante sur une dizaine de km. */
export function projection(lat0: number, lon0: number) {
  const kx = RAYON_TERRE * Math.cos(rad(lat0));
  return {
    xy: (lat: number, lon: number): [number, number] => [rad(lon - lon0) * kx, rad(lat - lat0) * RAYON_TERRE],
    latlon: (x: number, y: number): Position => ({ lat: lat0 + deg(y / RAYON_TERRE), lon: lon0 + deg(x / kx) }),
  };
}

export function longueursCumulees(x: number[], y: number[]): number[] {
  const c = [0];
  for (let i = 1; i < x.length; i++) c.push(c[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]));
  return c;
}

/** Comme numpy.interp : xp croissant, valeurs bornées aux extrémités. */
export function interp(xq: number, xp: number[], fp: number[]): number {
  const n = xp.length;
  if (xq <= xp[0]) return fp[0];
  if (xq >= xp[n - 1]) return fp[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xp[mid] <= xq) lo = mid;
    else hi = mid;
  }
  const t = (xq - xp[lo]) / (xp[hi] - xp[lo] || 1);
  return fp[lo] + t * (fp[hi] - fp[lo]);
}

/** Un point tous les `pas` mètres le long de la polyligne. */
export function reechantillonner(x: number[], y: number[], pas: number) {
  const c = longueursCumulees(x, y);
  const total = c[c.length - 1];
  const d: number[] = [];
  for (let s = 0; s < total; s += pas) d.push(s);
  if (d.length === 0 || d[d.length - 1] < total) d.push(total);
  return { d, x: d.map((s) => interp(s, c, x)), y: d.map((s) => interp(s, c, y)) };
}

/** Distance à vol d'oiseau (haversine), en mètres. */
export function distanceM(a: Position, b: Position): number {
  const p1 = rad(a.lat);
  const p2 = rad(b.lat);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.sqrt(h));
}
