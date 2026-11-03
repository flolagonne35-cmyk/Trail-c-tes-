// Points d'eau potable (OpenStreetMap, © contributeurs, ODbL) sur le parcours d'une boucle.
//
// Fichiers par case de 1° (scripts/points_eau.py) : [lon × 1e5, lat × 1e5, type, nom, saisonnier,
// vérifié le]. On garde les points à moins de MARGE_M du tracé, avec leur kilomètre de passage : sur
// une sortie longue, savoir où remplir sa flasque change le choix de ce qu'on emporte.

import { distanceM, type Position } from "./geo.ts";

export type FichierEau = { source: string; types: string[]; points: [number, number, number, string, string, string][] };
export type PointEau = Position & { type: string; nom: string; saison: string; verif: string };
export type EauSurParcours = PointEau & { km: number; ecart_m: number };

/** Un détour de 150 m (aller-retour 300 m) reste acceptable pour remplir sa gourde. */
export const MARGE_M = 150;

/** Cases de 1° (coin sud-ouest « lat_lon ») qui touchent le rectangle autour du tracé. */
export function casesAutour(trace: Position[], margeKm = 1): string[] {
  if (!trace.length) return [];
  const lat0 = Math.min(...trace.map((p) => p.lat)) - margeKm / 111.2;
  const lat1 = Math.max(...trace.map((p) => p.lat)) + margeKm / 111.2;
  const k = 111.2 * Math.cos((trace[0].lat * Math.PI) / 180);
  const lon0 = Math.min(...trace.map((p) => p.lon)) - margeKm / k;
  const lon1 = Math.max(...trace.map((p) => p.lon)) + margeKm / k;
  const cases: string[] = [];
  for (let la = Math.floor(lat0); la <= Math.floor(lat1); la++) {
    for (let lo = Math.floor(lon0); lo <= Math.floor(lon1); lo++) cases.push(`${la}_${lo}`);
  }
  return cases;
}

export function lirePoints(f: FichierEau): PointEau[] {
  return f.points.map(([lo, la, t, nom, saison, verif]) => ({ lat: la / 1e5, lon: lo / 1e5, type: f.types[t] ?? "point d'eau", nom, saison, verif }));
}

/** Points d'eau à moins de `margeM` du tracé, avec le km où on passe au plus près, triés par km. */
export function eauSurParcours(points: PointEau[], trace: Position[], margeM = MARGE_M): EauSurParcours[] {
  if (trace.length < 2) return [];
  const cos = Math.cos((trace[0].lat * Math.PI) / 180);
  const xy = (p: Position): [number, number] => [p.lon * 111195 * cos, p.lat * 111195];
  const pts = trace.map(xy);
  const cumul = [0];
  for (let i = 1; i < trace.length; i++) cumul.push(cumul[i - 1] + distanceM(trace[i - 1], trace[i]));
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const [xmin, xmax, ymin, ymax] = [Math.min(...xs) - margeM, Math.max(...xs) + margeM, Math.min(...ys) - margeM, Math.max(...ys) + margeM];
  const res: EauSurParcours[] = [];
  for (const e of points) {
    const [px, py] = xy(e);
    if (px < xmin || px > xmax || py < ymin || py > ymax) continue;
    let best = Infinity; let km = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
      const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d < best) { best = d; km = (cumul[i - 1] + t * (cumul[i] - cumul[i - 1])) / 1000; }
    }
    if (best <= margeM) res.push({ ...e, km, ecart_m: Math.round(best) });
  }
  return res.sort((a, b) => a.km - b.km);
}

/** Libellé court : « Fontaine du parc (fontaine) · saisonnier · vérifiée en 2025-06 ». */
export function libelleEau(e: PointEau): string {
  return [e.nom ? `${e.nom} (${e.type})` : e.type[0].toUpperCase() + e.type.slice(1),
          e.saison ? `saisonnier${e.saison !== "oui" ? ` (${e.saison})` : ""}, souvent coupé l'hiver` : "",
          e.verif ? `vérifié en ${e.verif.slice(0, 7)}` : ""].filter(Boolean).join(" · ");
}
