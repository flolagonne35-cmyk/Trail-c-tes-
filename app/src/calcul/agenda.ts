// Courses à venir près de chez moi (calendrier issu de DATAtourisme et OpenAgenda, voir
// scripts/courses_ouvertes.py) : filtres et tri. Distances et D+ indicatifs, lus dans l'annonce.

import { distanceM, type Position } from "./geo.ts";
import { normaliser } from "./communes.ts";

export type CourseAVenir = {
  id: string; nom: string; date: string; fin: string; lat: number; lon: number; commune: string; cp: string;
  distances_km: number[]; dplus_m: number | null; type: "trail" | "route";
  site: string; source: string; auteur: string; maj: string;
};

export type FiltresAgenda = {
  rayonKm: number; // autour du point de départ ; Infinity = toute la France
  moisMax: number; // dans les N prochains mois
  type: "toutes" | "trail" | "route";
  kmMin?: number; kmMax?: number; // au moins un format dans cette plage
  texte?: string; // nom ou commune
  tri: "date" | "distance" | "longueur";
};

export type CourseProche = CourseAVenir & { distance_m: number };

export const FILTRES_AGENDA: FiltresAgenda = { rayonKm: 50, moisMax: 6, type: "toutes", tri: "date" };

/** Formats de la course dans la plage voulue (sans distance connue : gardée, faute de mieux). */
function formatOk(c: CourseAVenir, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (!c.distances_km.length) return false;
  return c.distances_km.some((d) => d >= (min ?? 0) && d <= (max ?? Infinity));
}

export function coursesAVenir(courses: CourseAVenir[], position: Position, f: FiltresAgenda, aujourdHui = new Date()): CourseProche[] {
  const debut = aujourdHui.toISOString().slice(0, 10);
  const limite = new Date(aujourdHui);
  limite.setMonth(limite.getMonth() + f.moisMax);
  const fin = limite.toISOString().slice(0, 10);
  const mots = normaliser(f.texte ?? "").split(" ").filter((m) => m.length >= 2);
  const res = courses
    .filter((c) => c.fin >= debut && c.date <= fin)
    .filter((c) => f.type === "toutes" || c.type === f.type)
    .filter((c) => formatOk(c, f.kmMin, f.kmMax))
    .filter((c) => !mots.length || mots.every((m) => normaliser(`${c.nom} ${c.commune} ${c.cp}`).includes(m)))
    .map((c) => ({ ...c, distance_m: distanceM(position, { lat: c.lat, lon: c.lon }) }))
    .filter((c) => c.distance_m <= f.rayonKm * 1000);
  const cle = { date: (c: CourseProche) => c.date, distance: (c: CourseProche) => c.distance_m,
                longueur: (c: CourseProche) => -(c.distances_km.at(-1) ?? 0) };
  return res.sort((a, b) => {
    const x = cle[f.tri](a);
    const y = cle[f.tri](b);
    return (x < y ? -1 : x > y ? 1 : 0) || a.date.localeCompare(b.date) || a.distance_m - b.distance_m;
  });
}

/** « 12, 25 et 42 km » */
export function formatsLisibles(d: number[]): string {
  const t = d.map((v) => String(v).replace(".", ","));
  return t.length > 1 ? `${t.slice(0, -1).join(", ")} et ${t.at(-1)} km` : t.length ? `${t[0]} km` : "";
}
