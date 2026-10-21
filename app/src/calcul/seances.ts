// Séance de répétitions : « 8 × 400 m à 10 % » → les endroits les plus proches qui collent.
// On cherche, dans le profil de chaque côte (montée ou descente), la portion de la longueur
// demandée dont la pente est la plus proche de la cible.

import { correspond, enDescente, type Cote, type Filtres, type Sens } from "./cotes.ts";
import { distanceM, interp, type Position } from "./geo.ts";
import { coutMinetti } from "./nutrition.ts";
import type { Segment } from "./profil.ts";

export type Seance = { repetitions: number; longueurM: number; pente: number | null };

/** « 8 × 400 m à 10 % », « 8x400 10% », « 6 x 1 km à 6 % », « 10 × 200 m » → séance (null si illisible). */
export function lireSeance(texte: string): Seance | null {
  const t = texte.toLowerCase().replace(",", ".").replace(/\s+/g, " ").trim();
  const m = t.match(/^(\d{1,2})\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(km|m)?\b(?:.*?(\d+(?:\.\d+)?)\s*%)?/);
  if (!m) return null;
  const repetitions = parseInt(m[1], 10);
  let longueurM = parseFloat(m[2]) * (m[3] === "km" ? 1000 : 1);
  if (!m[3] && longueurM < 10) longueurM *= 1000; // « 6 x 1 » : des kilomètres
  const pente = m[4] ? parseFloat(m[4]) : null;
  if (repetitions < 1 || longueurM < 50 || longueurM > 5000 || (pente !== null && (pente < 1 || pente > 40))) return null;
  return { repetitions, longueurM, pente };
}

export type Proposition = {
  cote: Cote; // dans le sens de la séance (montée ou descente)
  sens: Sens;
  debutM: number; // portion retenue, depuis le début de la côte
  finM: number;
  pente: number; // pente moyenne de la portion (%), positive
  dplusM: number; // dénivelé d'une répétition
  depart: Position;
  arrivee: Position;
  distance_m: number; // du point de départ de l'utilisateur au début de la portion
  ecartPente: number;
  courte: boolean; // côte un peu plus courte que la longueur demandée
  minutesEffort: number;
  minutesTotal: number; // répétitions + récupérations en trottinant
};

/** Position le long de la géométrie (simplifiée) d'une côte, à `s` mètres du début. */
export function pointA(cote: Cote, s: number): Position {
  const g = cote.geometrie;
  if (g.length < 2) return { lat: cote.lat, lon: cote.lon };
  const c = [0];
  for (let i = 1; i < g.length; i++) c.push(c[i - 1] + distanceM({ lat: g[i - 1][1], lon: g[i - 1][0] }, { lat: g[i][1], lon: g[i][0] }));
  const echelle = c[c.length - 1] / Math.max(cote.longueur_m, 1); // géométrie et profil n'ont pas tout à fait la même longueur
  const sq = s * echelle;
  return { lat: interp(sq, c, g.map((p) => p[1])), lon: interp(sq, c, g.map((p) => p[0])) };
}

/** Meilleure portion de `L` mètres : pente la plus proche de `cible` (ou la plus raide sans cible). */
export function meilleurePortion(cote: Cote, L: number, cible: number | null): { debut: number; pente: number } | null {
  const { d, z } = cote.profil;
  if (d.length < 2) return null;
  const longueur = d[d.length - 1];
  const portion = Math.min(L, longueur);
  let meilleur: { debut: number; pente: number; score: number } | null = null;
  for (let s = 0; s + portion <= longueur + 0.01; s += 10) {
    const pente = ((interp(s + portion, d, z) - interp(s, d, z)) / portion) * 100;
    const score = cible === null ? -pente : Math.abs(pente - cible);
    if (!meilleur || score < meilleur.score) meilleur = { debut: s, pente, score };
  }
  return meilleur && { debut: meilleur.debut, pente: meilleur.pente };
}

/**
 * Les `limite` meilleurs endroits pour la séance : pente à ±`tolerance` points de la cible
 * d'abord (puis les plus proches de la cible), et, à égalité, les plus près de `position`.
 */
export function chercherSeance(cotes: Cote[], position: Position, seance: Seance, sens: Sens, filtres: Filtres,
                               allurePlatMinKm = 5.5, limite = 3, tolerance = 1.5): Proposition[] {
  const props: Proposition[] = [];
  for (const brute of cotes) {
    // filtres de voie, de sol et de trafic seulement : la séance fixe la pente et la longueur
    const voie = { rayonM: filtres.rayonM, penteMin: 0, types: filtres.types, sols: filtres.sols, eviterPassant: filtres.eviterPassant };
    if (!correspond(brute, voie)) continue;
    if (brute.longueur_m < seance.longueurM * 0.8) continue;
    const cote = sens === "descente" ? enDescente(brute) : brute;
    // en descente, le profil descend : on cherche la pente la plus négative / la plus proche de −cible
    const sig = sens === "descente" ? -1 : 1;
    const portion = meilleurePortion(
      { ...cote, profil: { d: cote.profil.d, z: cote.profil.z.map((v) => sig * v) } }, seance.longueurM, seance.pente);
    if (!portion || portion.pente <= 0) continue;
    const L = Math.min(seance.longueurM, cote.longueur_m);
    const depart = pointA(cote, portion.debut);
    const minutesEffort = (L / 1000) * allurePlatMinKm * coutMinetti(sig * portion.pente / 100) / coutMinetti(0);
    const recup = (L / 1000) * allurePlatMinKm * 1.3; // retour en trottinant
    props.push({
      cote, sens, debutM: portion.debut, finM: portion.debut + L, pente: Math.round(portion.pente * 10) / 10,
      dplusM: Math.round(portion.pente * L / 100), depart, arrivee: pointA(cote, portion.debut + L),
      distance_m: distanceM(position, depart),
      ecartPente: seance.pente === null ? 0 : Math.abs(portion.pente - seance.pente),
      courte: cote.longueur_m < seance.longueurM,
      minutesEffort, minutesTotal: seance.repetitions * minutesEffort + (seance.repetitions - 1) * recup,
    });
  }
  const bon = (p: Proposition) => (p.ecartPente <= tolerance && !p.courte ? 0 : 1);
  return props
    .sort((a, b) => bon(a) - bon(b) || (bon(a) ? a.ecartPente - b.ecartPente : a.distance_m - b.distance_m))
    .slice(0, limite);
}

export const EXEMPLES_SEANCES = ["8 × 400 m à 10 %", "10 × 200 m à 8 %", "6 × 800 m à 6 %", "4 × 1 km à 5 %"];

// ---------------------------------------------------------------------------- préparer une course

export type Equivalent = {
  segment: Segment;
  sens: Sens;
  cote: Cote & { distance_m: number };
  repetitions: number; // pour retrouver le dénivelé du passage
  ecartPente: number;
};

/**
 * Passages-clés d'un parcours (les plus grosses montées et descentes) et, pour chacun, la côte
 * proche dont la pente est la plus semblable, avec le nombre de répétitions qui redonne son dénivelé.
 */
export function passagesCles(segments: Segment[], cotes: Cote[], position: Position, nombreMax = 4,
                             rayonM = 25000): Equivalent[] {
  const cles = segments
    .filter((s) => s.type !== "plat" && (s.type === "montée" ? s.dplus_m : s.dmoins_m) >= 50)
    .sort((a, b) => (b.type === "montée" ? b.dplus_m : b.dmoins_m) - (a.type === "montée" ? a.dplus_m : a.dmoins_m))
    .slice(0, nombreMax)
    .sort((a, b) => a.km_debut - b.km_debut);
  const proches = cotes
    .map((c) => ({ c, d: distanceM(position, { lat: c.lat, lon: c.lon }) }))
    .filter((x) => x.d <= rayonM);
  const resultat: Equivalent[] = [];
  for (const s of cles) {
    const sens: Sens = s.type === "montée" ? "montee" : "descente";
    const pente = Math.abs(s.pente_moy_pct);
    // pente semblable d'abord (± 2 points), puis la plus longue (plus proche de l'effort réel), puis la plus proche
    const choix = proches
      .map(({ c, d }) => ({ c, d, ecart: Math.abs(c.pente_moy_pct - pente) }))
      .sort((a, b) => Number(a.ecart > 2) - Number(b.ecart > 2) || (a.ecart > 2 ? a.ecart - b.ecart : 0)
                      || b.c.dplus_m - a.c.dplus_m || a.d - b.d)[0];
    if (!choix) continue;
    const cote = sens === "descente" ? enDescente(choix.c) : choix.c;
    const denivele = sens === "montee" ? s.dplus_m : s.dmoins_m;
    resultat.push({ segment: s, sens, cote: { ...cote, distance_m: choix.d }, ecartPente: choix.ecart,
                    repetitions: Math.max(1, Math.ceil(denivele / Math.max(choix.c.dplus_m, 1))) });
  }
  return resultat;
}
