// Choix des départements à charger autour d'un point.

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
