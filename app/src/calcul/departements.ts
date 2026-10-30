// Choix des départements à charger autour d'un point, et fusion avec les côtes embarquées.

import type { Cote } from "./cotes.ts";
import type { Position } from "./geo.ts";

export type IndexDepartements = { departements: Record<string, { emprise: number[]; nombre: number; fichiers: string[] }> };

/** Départements dont l'emprise [lat_min, lon_min, lat_max, lon_max] passe à moins de rayonKm du point. */
export function emprisesProches(idx: IndexDepartements, p: Position, rayonKm: number): string[] {
  const dLat = rayonKm / 111.2;
  const dLon = rayonKm / (111.2 * Math.cos((p.lat * Math.PI) / 180));
  return Object.entries(idx.departements)
    .filter(([, d]) => d.emprise && p.lat >= d.emprise[0] - dLat && p.lat <= d.emprise[2] + dLat
                       && p.lon >= d.emprise[1] - dLon && p.lon <= d.emprise[3] + dLon)
    .map(([k]) => k);
}

const dans = (c: Cote, e: number[]) => c.lat >= e[0] && c.lat <= e[2] && c.lon >= e[1] && c.lon <= e[3];

/** Côtes chargées, plus les côtes embarquées qui ne tombent dans aucun département chargé (pas de doublon). */
export function fusionnerCotes(chargees: Cote[], emprises: number[][], embarquees: Cote[]): Cote[] {
  return [...chargees, ...embarquees.filter((c) => !emprises.some((e) => dans(c, e)))];
}
