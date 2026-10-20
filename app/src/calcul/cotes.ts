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
  pentes_50m: number[];
  profil: { d: number[]; z: number[] };
  geometrie: [number, number][]; // [lon, lat]
};

export type Filtres = { rayonM: number; penteMin: number; types: TypeVoie[] };

export type CoteProche = Cote & { distance_m: number };

export function cotesProches(cotes: Cote[], position: Position, filtres: Filtres): CoteProche[] {
  return cotes
    .filter((c) => c.pente_moy_pct >= filtres.penteMin && filtres.types.includes(c.type_voie))
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

/** Résumé lisible des filtres actifs : « ≤ 5 km · pente ≥ 5 % · route, chemin ». */
export function resumeFiltres(f: Filtres): string {
  const types = (["route", "chemin", "sentier"] as TypeVoie[]).filter((t) => f.types.includes(t));
  return [`≤ ${f.rayonM / 1000} km`, `pente ≥ ${f.penteMin} %`, types.length === 3 ? "toutes voies" : types.join(", ") || "aucune voie"]
    .join(" · ");
}
