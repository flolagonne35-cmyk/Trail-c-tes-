// Courses à venir près de chez moi (calendrier issu de DATAtourisme et OpenAgenda, voir
// scripts/courses_ouvertes.py) : filtres et tri. Distances et D+ indicatifs, lus dans l'annonce.

import { distanceM, type Position } from "./geo.ts";
import { normaliser } from "./communes.ts";
import { DEPARTEMENTS, dansRegion, departementDeCp, nomRegion, REGIONS, regionDe } from "./regions.ts";

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

/** Où chercher : autour d'un lieu (ville, adresse ou GPS), dans un département, dans une région. */
export type Zone = { mode: "autour" } | { mode: "departement"; code: string } | { mode: "region"; code: string };

export type Groupe = { titre: string; courses: CourseProche[] };

/** Rayon de « la ville elle-même » : une course à moins de 5 km du centre est « à Rennes ». */
export const RAYON_VILLE_KM = 5;

/** Département d'une course : son code postal, sinon celui de la commune la plus proche. */
export function departementDe(c: CourseAVenir, depPres: (p: Position) => string): string {
  return departementDeCp(c.cp) || depPres({ lat: c.lat, lon: c.lon });
}

/**
 * Courses rangées comme on les cherche :
 * - autour d'une ville : « À Rennes », « Autour de Rennes (≤ 30 km) », puis « Ailleurs en Bretagne » ;
 * - dans un département : ce département, puis le reste de sa région ;
 * - dans une région : un groupe par département.
 * Les autres filtres (période, type, format, texte) et le tri s'appliquent dans chaque groupe.
 */
export function grouperCourses(courses: CourseAVenir[], zone: Zone, lieu: { position: Position; nom: string; dep: string },
                               f: FiltresAgenda, depDe: (c: CourseAVenir) => string, aujourdHui = new Date()): Groupe[] {
  const toutes = coursesAVenir(courses, lieu.position, { ...f, rayonKm: Infinity }, aujourdHui);
  const avecDep = toutes.map((c) => ({ c, dep: depDe(c) }));
  const nonVides = (g: Groupe[]) => g.filter((x) => x.courses.length);
  if (zone.mode === "autour") {
    const region = regionDe(lieu.dep);
    const gps = lieu.nom === "Ma position";
    const ville = avecDep.filter(({ c }) => c.distance_m <= RAYON_VILLE_KM * 1000).map(({ c }) => c);
    const autour = avecDep.filter(({ c }) => c.distance_m > RAYON_VILLE_KM * 1000 && c.distance_m <= f.rayonKm * 1000).map(({ c }) => c);
    const ailleurs = avecDep.filter(({ c, dep }) => c.distance_m > f.rayonKm * 1000 && region && regionDe(dep) === region).map(({ c }) => c);
    return nonVides([
      { titre: gps ? `Tout près (≤ ${RAYON_VILLE_KM} km)` : `À ${lieu.nom}`, courses: ville },
      { titre: Number.isFinite(f.rayonKm) ? `${gps ? "Autour de toi" : `Autour de ${lieu.nom}`} (≤ ${f.rayonKm} km)` : "Partout en France", courses: autour },
      { titre: `Ailleurs ${dansRegion(region)}`, courses: ailleurs },
    ]);
  }
  if (zone.mode === "departement") {
    const region = regionDe(zone.code);
    return nonVides([
      { titre: `${DEPARTEMENTS[zone.code] ?? zone.code} (${zone.code})`, courses: avecDep.filter(({ dep }) => dep === zone.code).map(({ c }) => c) },
      { titre: `Ailleurs ${dansRegion(region)}`, courses: avecDep.filter(({ dep }) => dep !== zone.code && regionDe(dep) === region).map(({ c }) => c) },
    ]);
  }
  const region = REGIONS.find((r) => r.code === zone.code);
  if (!region) return [];
  return nonVides(region.departements.map((d) => ({
    titre: `${DEPARTEMENTS[d]} (${d})`, courses: avecDep.filter(({ dep }) => dep === d).map(({ c }) => c),
  })).sort((a, b) => b.courses.length - a.courses.length));
}

/** Titre de la zone : « Autour de Rennes », « Ille-et-Vilaine (35) », « Bretagne ». */
export function nomZone(zone: Zone, lieu: { nom: string }): string {
  if (zone.mode === "departement") return `${DEPARTEMENTS[zone.code] ?? zone.code} (${zone.code})`;
  if (zone.mode === "region") return nomRegion(zone.code);
  return lieu.nom === "Ma position" ? "Autour de toi" : `Autour de ${lieu.nom}`;
}
