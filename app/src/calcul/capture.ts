// Lecture d'une capture d'écran (retours du 24/11) : une sortie Strava ou Garmin pour Mon monde,
// le profil d'une course pour le Jour J. Le modèle d'IA (Mistral Small 3.1, licence Apache 2.0,
// sur Workers AI) renvoie les chiffres en JSON ; on les vérifie ici avant de les proposer, et le
// coureur les corrige avant d'enregistrer. Commun à l'appli et à functions/api/capture.ts.

import { interp } from "./geo.ts";
import { analyserProfil, lisser, type Parcours } from "./profil.ts";

export type TypeCapture = "activite" | "profil";
export type LectureActivite = { distance_km: number | null; dplus_m: number | null; duree_min: number | null; date: string | null; titre: string | null };
export type LectureProfil = {
  nom: string | null; distance_km: number | null; dplus_m: number | null; dmoins_m: number | null;
  /** points lus sur la courbe du profil : [km, altitude m], du départ à l'arrivée */
  points: [number, number][];
  ravitos: { km: number; nom: string }[];
  barrieres: { km: number; heure: string }[];
};

export const CONSIGNES_CAPTURE: Record<TypeCapture, string> = {
  activite: "Tu lis une capture d'écran d'une application de course à pied (Strava, Garmin Connect, Coros, Suunto…). "
    + "Réponds UNIQUEMENT par un objet JSON : {\"distance_km\": nombre, \"dplus_m\": nombre, \"duree_min\": nombre (temps de déplacement en minutes), "
    + "\"date\": \"AAAA-MM-JJ\" ou null, \"titre\": texte ou null}. Mets null pour ce qui n'est pas écrit sur l'image. N'invente rien.",
  profil: "Tu lis une capture d'écran du profil d'une course de trail ou de route (graphique altitude en fonction de la distance). "
    + "Réponds UNIQUEMENT par un objet JSON : {\"nom\": texte ou null, \"distance_km\": nombre, \"dplus_m\": nombre, \"dmoins_m\": nombre ou null, "
    + "\"points\": [[km, altitude_m], …] au moins 15 points lus sur la courbe du départ à l'arrivée en suivant les axes gradués, "
    + "\"ravitos\": [{\"km\": nombre, \"nom\": texte}], \"barrieres\": [{\"km\": nombre, \"heure\": \"HH:MM\"}]}. "
    + "Mets null ou [] pour ce qui n'est pas lisible. N'invente rien.",
};

/** Premier objet JSON d'un texte (le modèle l'entoure parfois de ```json … ```). */
export function extraireJson(texte: string): Record<string, unknown> | null {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    const v = JSON.parse(texte.slice(debut, fin + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const nombreOuNul = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
};
const texteOuNul = (v: unknown, max = 80): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Valeurs plausibles seulement : une sortie de 0 à 400 km, 0 à 15 000 m de D+, moins de 4 jours. */
export function lireActivite(j: Record<string, unknown>): LectureActivite {
  const date = typeof j.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : null;
  return { distance_km: nombreOuNul(j.distance_km, 0.1, 400), dplus_m: nombreOuNul(j.dplus_m, 0, 15000),
           duree_min: nombreOuNul(j.duree_min, 1, 5760), date, titre: texteOuNul(j.titre) };
}

export function lireProfil(j: Record<string, unknown>): LectureProfil {
  const points = (Array.isArray(j.points) ? j.points : [])
    .map((p) => (Array.isArray(p) ? [nombreOuNul(p[0], 0, 400), nombreOuNul(p[1], -100, 6000)] : [null, null]))
    .filter((p): p is [number, number] => p[0] !== null && p[1] !== null)
    .sort((a, b) => a[0] - b[0])
    .filter((p, i, t) => i === 0 || p[0] > t[i - 1][0]);
  const ravitos = (Array.isArray(j.ravitos) ? j.ravitos : []).map((r) => r as Record<string, unknown>)
    .map((r) => ({ km: nombreOuNul(r.km, 0, 400), nom: texteOuNul(r.nom, 40) ?? "Ravitaillement" }))
    .filter((r): r is { km: number; nom: string } => r.km !== null);
  const barrieres = (Array.isArray(j.barrieres) ? j.barrieres : []).map((r) => r as Record<string, unknown>)
    .map((r) => ({ km: nombreOuNul(r.km, 0, 400), heure: typeof r.heure === "string" && /^\d{1,2}:\d{2}$/.test(r.heure) ? r.heure : null }))
    .filter((r): r is { km: number; heure: string } => r.km !== null && r.heure !== null);
  return { nom: texteOuNul(j.nom), distance_km: nombreOuNul(j.distance_km, 0.5, 400), dplus_m: nombreOuNul(j.dplus_m, 0, 30000),
           dmoins_m: nombreOuNul(j.dmoins_m, 0, 30000), points, ravitos, barrieres };
}

/**
 * Profil lu → points tous les 100 m (interpolation linéaire entre les points lus), recalé pour que la
 * distance totale soit celle annoncée. Sert à construire un parcours quand on n'a pas de GPX.
 */
export function profilReechantillonne(l: LectureProfil): { d_m: number[]; z: number[] } | null {
  if (l.points.length < 5) return null;
  const total = l.distance_km ?? l.points[l.points.length - 1][0];
  const echelle = total / Math.max(l.points[l.points.length - 1][0], 0.001);
  const pts = l.points.map(([k, z]) => [k * echelle * 1000, z] as [number, number]);
  const d: number[] = [];
  const z: number[] = [];
  for (let s = 0, j = 0; s <= pts[pts.length - 1][0]; s += 100) {
    while (j < pts.length - 2 && pts[j + 1][0] < s) j++;
    const [d0, z0] = pts[j];
    const [d1, z1] = pts[Math.min(j + 1, pts.length - 1)];
    d.push(s);
    z.push(d1 > d0 ? z0 + ((z1 - z0) * (s - d0)) / (d1 - d0) : z0);
  }
  return { d_m: d, z };
}

/**
 * Parcours construit à partir d'une capture du profil : points lus tous les 100 m, puis tous les 10 m
 * (interpolation), lissés et découpés comme un GPX (montées, descentes, plats). Précision limitée à ce
 * que l'image montre : l'appli le signale (« profil lu sur une capture, à vérifier »).
 */
export function parcoursDepuisCapture(l: LectureProfil, nomParDefaut = "Course (capture)"): Parcours | null {
  const r = profilReechantillonne(l);
  if (!r) return null;
  const d: number[] = [];
  const z: number[] = [];
  const fin = r.d_m[r.d_m.length - 1];
  for (let s = 0; s <= fin; s += 10) {
    d.push(s);
    z.push(interp(s, r.d_m, r.z));
  }
  const p = analyserProfil(l.nom ?? nomParDefaut, d, lisser(z, 3), "Profil lu sur une capture (à vérifier)");
  // le D+ annoncé par l'organisateur prime sur celui de la courbe lue, souvent arrondie
  if (l.dplus_m) p.dplus_m = Math.round(l.dplus_m);
  if (l.dmoins_m) p.dmoins_m = Math.round(l.dmoins_m);
  return p;
}
