// Lever et coucher du soleil, calculés sur le téléphone (sans réseau), pour rappeler la frontale.
// Algorithme de l'almanach nautique (Almanac for Computers, 1990), repris par la NOAA : précision de
// l'ordre de la minute en France, suffisante pour « prends ta frontale ».

import type { Position } from "./geo.ts";

const rad = Math.PI / 180;

/** Heure UTC (en heures décimales) du lever (`lever` vrai) ou du coucher, ou null (jour ou nuit polaire). */
function heureUtc(date: Date, p: Position, lever: boolean): number | null {
  const debut = Date.UTC(date.getFullYear(), 0, 0);
  const jour = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - debut) / 86400000);
  const lngHeure = p.lon / 15;
  const t = jour + ((lever ? 6 : 18) - lngHeure) / 24;
  const M = 0.9856 * t - 3.289; // anomalie moyenne
  let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634; // longitude vraie
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15; // même quadrant que L, en heures
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const zenith = 90.833; // réfraction et rayon du disque solaire compris
  const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(p.lat * rad)) / (cosDec * Math.cos(p.lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  const H = (lever ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  return (((T - lngHeure) % 24) + 24) % 24;
}

/** Lever et coucher du soleil du jour `date` (dates JavaScript), ou null en jour ou nuit polaire. */
export function soleil(date: Date, p: Position): { lever: Date; coucher: Date } | null {
  const a = heureUtc(date, p, true);
  const b = heureUtc(date, p, false);
  if (a === null || b === null) return null;
  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return { lever: new Date(base + a * 3600000), coucher: new Date(base + b * 3600000) };
}

/** « 7 h 58 » à l'heure locale du téléphone. */
export const heureLisible = (d: Date) => `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
