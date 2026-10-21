// Boucles sur mesure : « 10 km, 3 côtes, 300 m de D+, retour à la voiture, pas de route ».
//
// Sur le graphe des voies (reseau.ts) : on part du nœud le plus proche du départ, on choisit des
// côtes candidates à portée, puis on essaie les combinaisons et les ordres de passage. Chaque
// boucle = départ → pied de la côte 1 → montée → pied de la côte 2 → … → retour au départ, par
// les plus courts chemins pondérés (routes et trafic alourdis selon les préférences). On garde
// les boucles dont la distance et le D+ collent le mieux à la demande.

import type { Cote } from "./cotes.ts";
import { distanceM, type Position } from "./geo.ts";
import {
  chemin, dijkstra, noeudLePlusProche, pointsDuChemin, type Arbre, type Graphe, type Preferences,
} from "./reseau.ts";

export type Demande = Preferences & { distanceKm: number; nbCotes: number; dplusVise: number | null };

export type Etape = { type: "liaison" | "cote"; points: Position[]; cote?: Cote };

export type Boucle = {
  cotes: Cote[];
  distance_m: number;
  dplus_m: number;
  etapes: Etape[];
  partRoute: number; // part de la distance sur route (0 à 1), hors côtes
  partPassant: number; // part sur route passante
  partRepassee: number; // part de la distance courue deux fois sur les mêmes rues (aller-retour)
  ecartDistance: number; // relatif
  detour: boolean; // un passage par un point de détour allonge la boucle
  // D+ visé hors d'atteinte : répétitions conseillées sur la côte la plus haute de la boucle
  repetitions: { cote: Cote; n: number; distanceEnPlus_m: number } | null;
};

type Candidate = { cote: Cote; pied: number; sommet: number; arbre: Arbre };
type Jambe = { de: number; vers: number; arbre: Arbre };

const DIST_ACCROCHE_MAX_M = 80;

function evaluer(sequence: (Candidate | number)[], depart: Arbre, arbres: Map<number, Arbre>) {
  // sequence : côtes et points de détour (numéros de nœud), dans l'ordre de passage
  let longueur = 0;
  let plus = 0;
  let cumul = 0;
  let courant: Arbre = depart;
  const jambes: Jambe[] = [];
  for (const x of sequence) {
    const cible = typeof x === "number" ? x : x.pied;
    if (!Number.isFinite(courant.cumul[cible])) return null;
    jambes.push({ de: courant.source, vers: cible, arbre: courant });
    longueur += courant.longueur[cible];
    plus += courant.plus[cible];
    cumul += courant.cumul[cible];
    if (typeof x === "number") {
      courant = arbres.get(x)!;
    } else {
      longueur += x.cote.longueur_m;
      plus += x.cote.dplus_m;
      cumul += x.cote.longueur_m;
      courant = x.arbre;
    }
  }
  const retour = depart.source;
  if (!Number.isFinite(courant.cumul[retour])) return null;
  jambes.push({ de: courant.source, vers: retour, arbre: courant });
  longueur += courant.longueur[retour];
  plus += courant.plus[retour];
  cumul += courant.cumul[retour];
  return { longueur, plus, cumul, jambes };
}

function* combinaisons<T>(liste: T[], k: number, debut = 0, actuel: T[] = []): Generator<T[]> {
  if (actuel.length === k) { yield actuel; return; }
  for (let i = debut; i <= liste.length - (k - actuel.length); i++) yield* combinaisons(liste, k, i + 1, [...actuel, liste[i]]);
}

function permutations<T>(liste: T[]): T[][] {
  if (liste.length <= 1) return [liste];
  return liste.flatMap((x, i) => permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map((p) => [x, ...p]));
}

export function composerBoucles(g: Graphe, cotes: Cote[], depart: Position, d: Demande, limite = 3): Boucle[] | string {
  const cible = d.distanceKm * 1000;
  const prefs: Preferences = { eviterRoutes: d.eviterRoutes, eviterPassant: d.eviterPassant };
  const s = noeudLePlusProche(g, depart);
  if (s.distance_m > 500) return "Point de départ hors du réseau calculé : choisis un départ dans la zone couverte.";
  const coutMax = cible * 3;
  const arbreDepart = dijkstra(g, s.noeud, prefs, coutMax);

  // côtes candidates : accrochées au réseau, à mi-distance au plus, les plus proches d'abord
  const candidates: Candidate[] = [];
  const triees = cotes
    .filter((c) => !(d.eviterPassant && c.trafic === "passant") && !(d.eviterRoutes && c.type_voie === "route"))
    // à vol d'oiseau au-delà de la mi-distance, la côte est hors de portée : inutile de l'accrocher
    // au réseau (le plus coûteux : une recherche sur tous les nœuds, deux fois par côte)
    .filter((c) => distanceM(depart, c) <= cible / 2)
    .map((c) => {
      const pied = noeudLePlusProche(g, { lat: c.lat, lon: c.lon });
      const fin = c.geometrie[c.geometrie.length - 1] ?? [c.lon, c.lat];
      const sommet = noeudLePlusProche(g, { lat: fin[1], lon: fin[0] });
      return { c, pied, sommet };
    })
    .filter(({ pied, sommet }) => pied.distance_m <= DIST_ACCROCHE_MAX_M && sommet.distance_m <= DIST_ACCROCHE_MAX_M
      && pied.noeud !== sommet.noeud && arbreDepart.longueur[pied.noeud] + 1 > 0
      && Number.isFinite(arbreDepart.cumul[pied.noeud]) && arbreDepart.longueur[pied.noeud] <= cible / 2)
    .sort((a, b) => arbreDepart.longueur[a.pied.noeud] - arbreDepart.longueur[b.pied.noeud])
    .slice(0, 14);
  for (const { c, pied, sommet } of triees) {
    candidates.push({ cote: c, pied: pied.noeud, sommet: sommet.noeud, arbre: dijkstra(g, sommet.noeud, prefs, coutMax) });
  }
  const k = Math.min(d.nbCotes, candidates.length);
  if (k === 0 && d.nbCotes > 0) return "Aucune côte à portée avec ces préférences : élargis la distance ou autorise les routes.";

  const arbres = new Map<number, Arbre>();
  type Essai = { seq: (Candidate | number)[]; r: NonNullable<ReturnType<typeof evaluer>>; score: number };
  const essais: Essai[] = [];
  const noter = (seq: (Candidate | number)[]) => {
    const r = evaluer(seq, arbreDepart, arbres);
    if (!r || r.longueur < cible * 0.3) return; // impossible à joindre, ou boucle vide
    const eDist = Math.abs(r.longueur - cible) / cible;
    const eDplus = d.dplusVise ? Math.abs(r.plus - d.dplusVise) / Math.max(d.dplusVise, 50) : 0;
    const penibilite = (r.cumul - r.longueur) / r.longueur; // part de routes / trafic évités
    essais.push({ seq, r, score: 2 * eDist + eDplus + 0.3 * penibilite });
  };
  for (const combo of k ? combinaisons(candidates, k) : [[] as Candidate[]]) {
    for (const ordre of permutations(combo)) noter(ordre);
  }
  essais.sort((a, b) => a.score - b.score);

  // boucle trop courte, ou sortie sans côte : on passe par des points de détour, sur des cercles
  // autour du départ. Sans côte, deux détours à 60–150° l'un de l'autre font une vraie boucle
  // (un triangle) plutôt qu'un aller-retour.
  if (k === 0 || !essais.length || Math.abs(essais[0].r.longueur - cible) / cible > 0.12) {
    const meilleures = essais.slice(0, 6);
    const detours: { noeud: number; angle: number }[] = [];
    const facteurs = k === 0 ? [0.8, 1.15, 1.5] : [0.55, 0.8, 1.05];
    for (const facteur of facteurs) for (let i = 0; i < 12; i++) {
      const rayon = (cible / (2 * Math.PI)) * facteur;
      const a = (i / 12) * 2 * Math.PI;
      const p = { lat: depart.lat + (rayon * Math.cos(a)) / 111195,
                  lon: depart.lon + (rayon * Math.sin(a)) / (111195 * Math.cos((depart.lat * Math.PI) / 180)) };
      const n = noeudLePlusProche(g, p);
      if (n.distance_m < 300 && Number.isFinite(arbreDepart.cumul[n.noeud]) && !detours.some((x) => x.noeud === n.noeud)) {
        detours.push({ noeud: n.noeud, angle: a });
      }
    }
    for (const w of detours) arbres.set(w.noeud, dijkstra(g, w.noeud, prefs, coutMax));
    if (k === 0) {
      for (const w1 of detours) for (const w2 of detours) {
        const ecart = (((w2.angle - w1.angle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (ecart >= Math.PI / 3 && ecart <= (5 * Math.PI) / 6) noter([w1.noeud, w2.noeud]);
      }
    } else {
      const bases = meilleures.length ? meilleures.map((e) => e.seq) : [[]];
      for (const seq of bases) {
        for (const w of detours) {
          for (let pos = 0; pos <= seq.length; pos++) noter([...seq.slice(0, pos), w.noeud, ...seq.slice(pos)]);
        }
      }
    }
    essais.sort((a, b) => a.score - b.score);
  }

  // boucles distinctes (pas le même ensemble de côtes) ; parmi les 12 meilleures, on écarte celles
  // qui repassent par les mêmes rues (un aller-retour déguisé)
  const vues = new Set<string>();
  const candidates2: { b: Boucle; score: number }[] = [];
  for (const e of essais) {
    // sans côte, deux boucles diffèrent par leurs détours (arrondis à ~1 km pour écarter les quasi-doublons)
    const cle = e.seq.filter((x): x is Candidate => typeof x !== "number").map((x) => x.cote.id).sort().join("-")
      || e.seq.map((w) => `${Math.round(g.lat[w as number] * 100)},${Math.round(g.lon[w as number] * 70)}`).join("|");
    if (vues.has(cle)) continue;
    vues.add(cle);
    const b = construire(g, e.seq, e.r, cible, d.dplusVise);
    candidates2.push({ b, score: e.score + 2 * b.partRepassee });
    if (candidates2.length >= 12) break;
  }
  return candidates2.sort((a, b) => a.score - b.score).slice(0, limite).map((x) => x.b);
}

function construire(g: Graphe, seq: (Candidate | number)[], r: NonNullable<ReturnType<typeof evaluer>>, cible: number,
                     dplusVise: number | null): Boucle {
  const etapes: Etape[] = [];
  let route = 0;
  let passant = 0;
  let liaison = 0;
  const parcourues = new Map<number, number>(); // arête → mètres déjà parcourus
  const cotes = seq.filter((x): x is Candidate => typeof x !== "number");
  let iCote = 0;
  r.jambes.forEach((j, i) => {
    const aretes = chemin(g, j.arbre, j.vers);
    for (const { arete: k } of aretes) {
      parcourues.set(k, (parcourues.get(k) ?? 0) + 1);
      liaison += g.longueur[k];
      if (g.types[g.type[k]] === "route") route += g.longueur[k];
      if (g.trafics[g.trafic[k]] === "passant") passant += g.longueur[k];
    }
    etapes.push({ type: "liaison", points: pointsDuChemin(g, aretes) });
    // après chaque jambe vers un pied de côte, la montée elle-même
    const suivant = seq[i];
    if (suivant !== undefined && typeof suivant !== "number") {
      const c = cotes[iCote++].cote;
      etapes.push({ type: "cote", cote: c, points: c.geometrie.map(([lon, lat]) => ({ lat, lon })) });
    }
  });
  let repetitions: Boucle["repetitions"] = null;
  const haute = cotes.map((c) => c.cote).sort((a, b) => b.dplus_m - a.dplus_m)[0];
  if (dplusVise && haute && dplusVise - r.plus > 10) {
    const n = Math.ceil((dplusVise - r.plus) / Math.max(haute.dplus_m, 1));
    repetitions = { cote: haute, n, distanceEnPlus_m: Math.round(n * 2 * haute.longueur_m) };
  }
  return {
    repetitions,
    cotes: cotes.map((c) => c.cote), distance_m: Math.round(r.longueur), dplus_m: Math.round(r.plus), etapes,
    partRoute: liaison ? route / liaison : 0, partPassant: liaison ? passant / liaison : 0,
    partRepassee: liaison ? [...parcourues].reduce((t, [k, n]) => t + (n > 1 ? (n - 1) * g.longueur[k] : 0), 0) / r.longueur : 0,
    ecartDistance: (r.longueur - cible) / cible, detour: seq.some((x) => typeof x === "number"),
  };
}

/** Tous les points de la boucle, dans l'ordre (carte, GPX). */
export const pointsBoucle = (b: Boucle): Position[] => b.etapes.flatMap((e) => e.points);
