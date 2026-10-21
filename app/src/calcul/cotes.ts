// Côtes précalculées (exportées par scripts/exporter_app.py) : filtres et tri par distance.

import { distanceM, type Position } from "./geo.ts";

export type TypeVoie = "route" | "chemin" | "sentier" | "piste cyclable";

export type Cote = {
  id: number;
  lat: number; // départ (pied de la côte)
  lon: number;
  longueur_m: number;
  pente_moy_pct: number;
  pente_max_pct: number;
  dplus_m: number;
  alt_depart_m: number;
  alt_arrivee_m: number;
  type_voie: TypeVoie;
  nom: string;
  revetement: string;
  technicite: string;
  adresse?: string; // adresse du pied, calculée au précalcul (géocodage inverse IGN)
  trafic?: Trafic | ""; // exposition au trafic (BD TOPO) ; vide pour les anciennes données
  sens?: Sens; // « descente » : la côte parcourue depuis le sommet (voir `enDescente`)
  pentes_50m: number[];
  profil: { d: number[]; z: number[] };
  geometrie: [number, number][]; // [lon, lat]
};

export type Trafic = "calme" | "modéré" | "passant";
export type Sens = "montee" | "descente";
export type Longueur = "toutes" | "courtes" | "moyennes" | "longues";

/**
 * Critères de recherche. Chaque plage a un minimum et un maximum facultatif (absent = sans limite) :
 * pente moyenne, passage le plus raide (pente max sur 50 m), longueur, D+.
 */
export type Filtres = {
  rayonM: number; penteMin: number; types: TypeVoie[];
  penteMax?: number; raideMin?: number; raideMax?: number;
  longueurMin?: number; longueurMax?: number;
  longueur?: Longueur; // ancienne catégorie (séances) ; l'écran utilise longueurMin / longueurMax
  dplusMin?: number; dplusMax?: number;
  sols?: Sol[]; // vide ou absent = tous
  eviterPassant?: boolean;
};

/** Sol de la côte : goudronné (route, piste) ou non (terre, gravier, herbe…), d'après BD TOPO et OSM. */
export type Sol = "goudronne" | "terre";
export const solDe = (c: Cote): Sol => (c.revetement.startsWith("goudronné") || c.revetement === "pavé" ? "goudronne" : "terre");

/** Ordres de tri des résultats. */
export type CleTri = "distance" | "pente" | "raide" | "longueur" | "dplus";
export const TRIS: Record<CleTri, { nom: string; croissant: string; decroissant: string }> = {
  distance: { nom: "Distance", croissant: "la plus proche d'abord", decroissant: "la plus loin d'abord" },
  pente: { nom: "Pente moyenne", croissant: "la plus douce d'abord", decroissant: "la plus raide d'abord" },
  raide: { nom: "Passage le plus raide", croissant: "le plus doux d'abord", decroissant: "le plus raide d'abord" },
  longueur: { nom: "Longueur", croissant: "la plus courte d'abord", decroissant: "la plus longue d'abord" },
  dplus: { nom: "Dénivelé", croissant: "le plus faible d'abord", decroissant: "le plus fort d'abord" },
};
const VALEUR_TRI: Record<CleTri, (c: CoteProche) => number> = {
  distance: (c) => c.distance_m, pente: (c) => c.pente_moy_pct, raide: (c) => c.pente_max_pct,
  longueur: (c) => c.longueur_m, dplus: (c) => c.dplus_m,
};

/** Trie les côtes ; à égalité, la plus proche d'abord. */
export function trierCotes(cotes: CoteProche[], cle: CleTri, croissant: boolean): CoteProche[] {
  const v = VALEUR_TRI[cle];
  return [...cotes].sort((a, b) => (croissant ? v(a) - v(b) : v(b) - v(a)) || a.distance_m - b.distance_m);
}

/** Catégories de longueur, parlantes pour un traileur. */
export const LONGUEURS: Record<Exclude<Longueur, "toutes">, { min: number; max: number; nom: string; detail: string }> = {
  courtes: { min: 0, max: 300, nom: "Courtes", detail: "< 300 m : répétitions courtes, puissance" },
  moyennes: { min: 300, max: 800, nom: "Moyennes", detail: "300 à 800 m : séries classiques" },
  longues: { min: 800, max: Infinity, nom: "Longues", detail: "≥ 800 m : longues montées, endurance" },
};

export const NOMS_TRAFIC: Record<Trafic, string> = {
  calme: "Voie calme", "modéré": "Trafic modéré", passant: "Route passante",
};

/** La même côte parcourue du sommet vers le pied : une descente de même pente. */
export function enDescente(c: Cote): Cote {
  const L = c.longueur_m;
  return {
    ...c, sens: "descente",
    lat: c.geometrie.length ? c.geometrie[c.geometrie.length - 1][1] : c.lat,
    lon: c.geometrie.length ? c.geometrie[c.geometrie.length - 1][0] : c.lon,
    alt_depart_m: c.alt_arrivee_m, alt_arrivee_m: c.alt_depart_m,
    pentes_50m: [...c.pentes_50m].reverse(),
    profil: { d: [...c.profil.d].reverse().map((d) => Math.round((L - d) * 10) / 10), z: [...c.profil.z].reverse() },
    geometrie: [...c.geometrie].reverse(),
  };
}

export type CoteProche = Cote & { distance_m: number };

const dans = (v: number, min = -Infinity, max = Infinity) => v >= min && v <= max;

export function correspond(c: Cote, f: Filtres): boolean {
  const cat = f.longueur && f.longueur !== "toutes" ? LONGUEURS[f.longueur] : null;
  return dans(c.pente_moy_pct, f.penteMin, f.penteMax) && f.types.includes(c.type_voie)
    && dans(c.pente_max_pct, f.raideMin, f.raideMax)
    && (!cat || (c.longueur_m >= cat.min && c.longueur_m < cat.max))
    && dans(c.longueur_m, f.longueurMin, f.longueurMax)
    && dans(c.dplus_m, f.dplusMin ?? 0, f.dplusMax)
    && (!f.sols?.length || f.sols.includes(solDe(c)))
    && !(f.eviterPassant && c.trafic === "passant");
}

export function cotesProches(cotes: Cote[], position: Position, filtres: Filtres): CoteProche[] {
  return cotes
    .filter((c) => correspond(c, filtres))
    .map((c) => ({ ...c, distance_m: distanceM(position, { lat: c.lat, lon: c.lon }) }))
    .filter((c) => c.distance_m <= filtres.rayonM)
    .sort((a, b) => a.distance_m - b.distance_m);
}

export const kmLisibles = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/** Temps estimé pour monter la côte, à partir de l'allure sur le plat (min/km) et du coût de Minetti. */
export function dureeMontee(cote: Cote, allurePlatMinKm: number, cout: (i: number) => number): number {
  const ratio = cout(cote.pente_moy_pct / 100) / cout(0);
  return (cote.longueur_m / 1000) * allurePlatMinKm * ratio;
}

/** Au-delà de cette distance de la côte la plus proche, la zone n'est pas encore calculée. */
export const RAYON_COUVERTURE_M = 30000;

/** Distance à la côte calculée la plus proche (tous filtres confondus). */
export function distanceCouverture(cotes: Cote[], position: Position): number {
  return cotes.reduce((m, c) => Math.min(m, distanceM(position, { lat: c.lat, lon: c.lon })), Infinity);
}

const fr = (v: number) => String(v).replace(".", ",");
/** « 4 à 8 % », « ≥ 6 % », « ≤ 300 m » ; vide si la plage ne filtre rien. */
export function plageLisible(min: number | undefined, max: number | undefined, unite: string, minNeutre = 0): string {
  const a = min !== undefined && min > minNeutre ? min : undefined;
  if (a !== undefined && max !== undefined) return a === max ? `${fr(a)} ${unite}` : `${fr(a)} à ${fr(max)} ${unite}`;
  if (a !== undefined) return `≥ ${fr(a)} ${unite}`;
  if (max !== undefined) return `≤ ${fr(max)} ${unite}`;
  return "";
}

/** Résumé lisible des filtres actifs : « ≤ 5 km · pente ≥ 5 % · route, chemin ». */
export function resumeFiltres(f: Filtres): string {
  const types = (["route", "chemin", "sentier"] as TypeVoie[]).filter((t) => f.types.includes(t));
  const raide = plageLisible(f.raideMin, f.raideMax, "%");
  const longueur = plageLisible(f.longueurMin, f.longueurMax, "m");
  const dplus = plageLisible(f.dplusMin, f.dplusMax, "m");
  return [`≤ ${fr(f.rayonM / 1000)} km`, `pente ${plageLisible(f.penteMin, f.penteMax, "%", -1)}`,
          ...(raide ? [`passage max ${raide}`] : []),
          ...(f.longueur && f.longueur !== "toutes" ? [LONGUEURS[f.longueur].nom.toLowerCase()] : []),
          ...(longueur ? [`longueur ${longueur}`] : []),
          ...(dplus ? [`D+ ${dplus}`] : []),
          ...(f.sols?.length === 1 ? [f.sols[0] === "goudronne" ? "goudronné" : "non goudronné"] : []),
          types.length === 3 ? "toutes voies" : types.join(", ") || "aucune voie",
          ...(f.eviterPassant ? ["sans route passante"] : [])]
    .join(" · ");
}
