// Points et vérification des sorties : barème, contrôles anti-triche, répétitions sur les côtes connues.
//
// Une sortie GPX est vérifiable : horodatage, vitesse, trace. Elle est validée tout de suite.
// Une capture d'écran (Strava, Garmin) ne l'est pas : ses points restent « en attente » jusqu'à
// une validation (modération côté serveur, à venir).

import type { Cote } from "./cotes.ts";
import { distanceM } from "./geo.ts";
import { lireGpx } from "./gpx.ts";

/** Barème : à ajuster. Le dénivelé pèse autant que la distance (10 m de D+ = 1 km). */
export const BAREME = {
  parKm: 1,
  parDplus10m: 1,
  /** chaque montée d'une côte connue rapporte 1 point par tranche de 5 m de D+ (au moins 1) */
  repetitionParDplus5m: 1,
  /** au-delà, une sortie est jugée incompatible avec la course à pied (vélo, voiture) */
  vitesseMaxKmh: 22,
  /** distance prise en compte au plus par semaine, pour limiter les abus */
  plafondKmSemaine: 250,
};

/** Un passage chronométré sur une côte : durée de la montée et FC moyenne (si le GPX les a). */
export type Passage = { temps_s: number | null; fc: number | null };

export type Repetition = {
  cote_id: number; nom: string; longueur_m: number; pente_moy_pct: number; n: number;
  cle?: string; // position du pied, stable d'un précalcul à l'autre (l'id change)
  dplus_m?: number;
  passages?: Passage[];
};

/** Identifiant stable d'une côte : son pied arrondi à ~10 m. */
export const cleCote = (c: Pick<Cote, "lat" | "lon">) => `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;

export type Activite = {
  id: string;
  date: string; // ISO
  source: "gpx" | "photo";
  statut: "validee" | "en_attente" | "refusee";
  nom: string;
  distance_km: number;
  dplus_m: number;
  duree_min: number | null;
  repetitions: Repetition[];
  points: number;
  empreinte: string; // détecte un même fichier envoyé deux fois
  photo?: string;
  motif?: string;
};

export function pointsRepetition(c: Pick<Cote, "dplus_m">): number {
  return Math.max(1, Math.round(c.dplus_m / 5)) * BAREME.repetitionParDplus5m;
}

export function calculerPoints(distanceKm: number, dplusM: number, repetitions: Repetition[], cotes: Cote[]): number {
  const parCote = new Map(cotes.map((c) => [c.id, c]));
  const reps = repetitions.reduce((s, r) => s + r.n * pointsRepetition(parCote.get(r.cote_id) ?? { dplus_m: 0 }), 0);
  return Math.round(distanceKm * BAREME.parKm + (dplusM / 10) * BAREME.parDplus10m + reps);
}

/** D+ d'une suite d'altitudes, en ignorant les oscillations de moins de `seuil` m (bruit GPS / baro). */
export function denivelePositif(z: (number | null)[], seuil = 3): number {
  let total = 0;
  let bas: number | null = null; // creux de référence
  let haut = 0; // plus haut point depuis ce creux
  let monte = false;
  for (const v of z) {
    if (v === null || !Number.isFinite(v)) continue;
    if (bas === null) {
      bas = haut = v;
      continue;
    }
    haut = Math.max(haut, v);
    if (!monte && v - bas >= seuil) monte = true;
    if (monte && haut - v >= seuil) { // la montée est finie : on la compte en entier
      total += haut - bas;
      bas = haut = v;
      monte = false;
    } else if (!monte && v < bas) {
      bas = haut = v;
    }
  }
  return monte && bas !== null ? total + haut - bas : total;
}

/**
 * Montées complètes de chaque côte : la trace passe à moins de `tolM` du pied, puis du sommet,
 * avec entre les deux une distance parcourue proche de la longueur de la côte.
 */
export function compterRepetitions(lat: number[], lon: number[], cotes: Cote[], tolM = 30,
                                   temps: (number | null)[] = [], fc: (number | null)[] = []): Repetition[] {
  const cumul = [0];
  for (let i = 1; i < lat.length; i++) cumul.push(cumul[i - 1] + distanceM({ lat: lat[i - 1], lon: lon[i - 1] }, { lat: lat[i], lon: lon[i] }));
  const latMin = Math.min(...lat) - 0.01, latMax = Math.max(...lat) + 0.01;
  const lonMin = Math.min(...lon) - 0.015, lonMax = Math.max(...lon) + 0.015;
  const resultats: Repetition[] = [];
  for (const c of cotes) {
    if (c.lat < latMin || c.lat > latMax || c.lon < lonMin || c.lon > lonMax || !c.geometrie.length) continue;
    const [lonS, latS] = c.geometrie[c.geometrie.length - 1];
    const piedC = { lat: c.lat, lon: c.lon };
    const sommet = { lat: latS, lon: lonS };
    const dist = (i: number, q: typeof piedC) => distanceM({ lat: lat[i], lon: lon[i] }, q);
    let pied: number | null = null; // point le plus près du pied lors du dernier passage
    let auPied = false;
    let n = 0;
    const passages: Passage[] = [];
    for (let i = 0; i < lat.length; i++) {
      const dPied = dist(i, piedC);
      if (dPied <= tolM) {
        if (!auPied || pied === null || dPied < dist(pied, piedC)) pied = i;
        auPied = true;
        continue;
      }
      auPied = false;
      if (pied !== null && dist(i, sommet) <= tolM) {
        // on garde le point le plus près du sommet tant qu'on reste dans sa zone : chrono au mètre près
        let haut = i;
        while (haut + 1 < lat.length && dist(haut + 1, sommet) <= tolM && dist(haut + 1, sommet) < dist(haut, sommet)) haut += 1;
        const parcouru = cumul[haut] - cumul[pied];
        if (parcouru >= 0.7 * c.longueur_m && parcouru <= 1.5 * c.longueur_m) {
          n += 1;
          const t0 = temps[pied] ?? null;
          const t1 = temps[haut] ?? null;
          const f = fc.slice(pied, haut + 1).filter((v): v is number => v !== null);
          passages.push({ temps_s: t0 !== null && t1 !== null ? Math.round((t1 - t0) / 1000) : null,
                          fc: f.length ? Math.round(f.reduce((a, b) => a + b, 0) / f.length) : null });
        }
        pied = null;
        i = haut;
      }
    }
    if (n) resultats.push({ cote_id: c.id, nom: c.nom, longueur_m: c.longueur_m, pente_moy_pct: c.pente_moy_pct, n,
                            cle: cleCote(c), dplus_m: c.dplus_m, passages });
  }
  return resultats;
}

/** Analyse un GPX de sortie : contrôles, distance, D+, répétitions, points. */
export function activiteDepuisGpx(texte: string, cotes: Cote[], compteCreeLe: string, empreintes: string[]): Activite {
  const t = lireGpx(texte, "Sortie");
  const horaires = t.temps.filter((v): v is number => v !== null);
  let distance = 0;
  for (let i = 1; i < t.lat.length; i++) distance += distanceM({ lat: t.lat[i - 1], lon: t.lon[i - 1] }, { lat: t.lat[i], lon: t.lon[i] });
  const debut = horaires.length ? Math.min(...horaires) : null;
  const dureeMin = horaires.length > 1 ? (Math.max(...horaires) - Math.min(...horaires)) / 60000 : null;
  const empreinte = `${debut ?? "?"}-${t.lat.length}-${t.lat[0].toFixed(4)}-${t.lon[0].toFixed(4)}`;
  const repetitions = compterRepetitions(t.lat, t.lon, cotes, 30, t.temps, t.fc);
  const dplus = denivelePositif(t.ele);
  const base: Activite = {
    id: empreinte, date: new Date(debut ?? Date.now()).toISOString(), source: "gpx", statut: "validee", nom: t.nom,
    distance_km: Math.round(distance / 10) / 100, dplus_m: Math.round(dplus), duree_min: dureeMin && Math.round(dureeMin),
    repetitions, points: calculerPoints(distance / 1000, dplus, repetitions, cotes), empreinte,
  };
  const refus = (motif: string): Activite => ({ ...base, statut: "refusee", points: 0, motif });
  if (debut === null) return refus("GPX sans horodatage : impossible de dater la sortie.");
  if (debut < Date.parse(compteCreeLe)) return refus("Sortie antérieure à la création du compte.");
  if (debut > Date.now() + 3600_000) return refus("Sortie datée dans le futur.");
  if (empreintes.includes(empreinte)) return refus("Cette sortie a déjà été envoyée.");
  if (dureeMin && dureeMin > 0 && distance / 1000 / (dureeMin / 60) > BAREME.vitesseMaxKmh) {
    return refus(`Vitesse moyenne supérieure à ${BAREME.vitesseMaxKmh} km/h : sortie à vélo ?`);
  }
  return base;
}

/** Sortie déclarée depuis une capture d'écran : points calculés mais en attente de validation. */
export function activiteDepuisPhoto(saisie: { date: string; distance_km: number; dplus_m: number; photo: string },
                                    compteCreeLe: string): Activite {
  const empreinte = `photo-${saisie.date}-${saisie.distance_km}-${saisie.dplus_m}`;
  const a: Activite = {
    id: `${empreinte}-${Date.now()}`, date: saisie.date, source: "photo", statut: "en_attente", nom: "Sortie (capture)",
    distance_km: saisie.distance_km, dplus_m: saisie.dplus_m, duree_min: null, repetitions: [], photo: saisie.photo,
    points: calculerPoints(saisie.distance_km, saisie.dplus_m, [], []), empreinte,
  };
  if (Date.parse(saisie.date) < Date.parse(compteCreeLe)) return { ...a, statut: "refusee", points: 0, motif: "Sortie antérieure à la création du compte." };
  return a;
}

/** Score : sorties validées, distance plafonnée par semaine. */
export function score(activites: Activite[]): { valides: number; enAttente: number } {
  const parSemaine = new Map<string, number>();
  let valides = 0;
  let enAttente = 0;
  for (const a of [...activites].sort((x, y) => x.date.localeCompare(y.date))) {
    if (a.statut === "en_attente") enAttente += a.points;
    if (a.statut !== "validee") continue;
    const d = new Date(a.date);
    const semaine = `${d.getUTCFullYear()}-${Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 604800000)}`;
    const deja = parSemaine.get(semaine) ?? 0;
    const kmComptes = Math.max(0, Math.min(a.distance_km, BAREME.plafondKmSemaine - deja));
    parSemaine.set(semaine, deja + a.distance_km);
    valides += a.points - Math.round((a.distance_km - kmComptes) * BAREME.parKm);
  }
  return { valides, enAttente };
}

export type PassageDate = Passage & { date: string; activite: string };

/** Tous mes passages chronométrés sur une côte, du plus récent au plus ancien. */
export function mesPassages(activites: Activite[], cote: Pick<Cote, "id" | "lat" | "lon">): PassageDate[] {
  const cle = cleCote(cote);
  return activites
    .filter((a) => a.statut === "validee")
    .flatMap((a) => a.repetitions
      .filter((r) => (r.cle ? r.cle === cle : r.cote_id === cote.id))
      .flatMap((r) => (r.passages ?? []).map((p) => ({ ...p, date: a.date, activite: a.id }))))
    .sort((x, y) => y.date.localeCompare(x.date));
}

/** Vitesse ascensionnelle (m/h), l'indicateur des traileurs pour comparer des montées. */
export const vitesseAscensionnelle = (dplusM: number, tempsS: number) => Math.round((dplusM / tempsS) * 3600);
