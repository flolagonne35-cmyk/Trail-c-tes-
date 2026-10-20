// Temps pour rejoindre le pied d'une côte : voiture, en courant, à pied, à vélo.
// Calculés à partir des itinéraires IGN quand ils sont disponibles, sinon estimés depuis la
// distance à vol d'oiseau (détour moyen de 30 %).

import { distanceM, type Position } from "./geo.ts";
import type { Trajet } from "./geoservices.ts";

export type Mode = "voiture" | "course" | "marche" | "velo";
export type TempsTrajet = { mode: Mode; minutes: number; distance_m: number; estime: boolean };

export const NOMS_MODES: Record<Mode, string> = { voiture: "en voiture", course: "en courant", marche: "à pied", velo: "à vélo" };

const DETOUR = 1.3;
const VITESSE_VOITURE_KMH = 35; // moyenne prudente, ville et petites routes
const VITESSE_MARCHE_KMH = 4.5;
const VITESSE_VELO_KMH = 16;

export function tempsTrajets(depart: Position, arrivee: Position, allureMinKm: number,
                             voiture?: Trajet | null, pieton?: Trajet | null): TempsTrajet[] {
  const dEstimee = distanceM(depart, arrivee) * DETOUR;
  const dPied = pieton?.distance_m ?? dEstimee;
  const estimePied = !pieton;
  return [
    { mode: "voiture", distance_m: voiture?.distance_m ?? dEstimee, estime: !voiture,
      minutes: voiture?.duree_min ?? (dEstimee / 1000 / VITESSE_VOITURE_KMH) * 60 + 2 },
    { mode: "course", distance_m: dPied, estime: estimePied, minutes: (dPied / 1000) * allureMinKm },
    { mode: "marche", distance_m: dPied, estime: estimePied,
      minutes: pieton?.duree_min ?? (dPied / 1000 / VITESSE_MARCHE_KMH) * 60 },
    { mode: "velo", distance_m: dPied, estime: true, minutes: (dPied / 1000 / VITESSE_VELO_KMH) * 60 },
  ].map((t) => ({ ...t, minutes: Math.max(1, Math.round(t.minutes)) })) as TempsTrajet[];
}

export function dureeLisible(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}
