// Chargement des points d'eau (OpenStreetMap) par case de 1°, publiés sur le site de l'appli (/eau/)
// par le workflow « Points d'eau (OpenStreetMap) ». Sans connexion : pas de points d'eau, sans erreur.

import { Platform } from "react-native";

import { casesAutour, lirePoints, type FichierEau, type PointEau } from "./calcul/eau.ts";
import type { Position } from "./calcul/geo.ts";

const BASE = Platform.OS === "web" ? "/eau/" : "https://trail-cotes.pages.dev/eau/";
const cache = new Map<string, Promise<PointEau[]>>();

function lireCase(cle: string): Promise<PointEau[]> {
  if (!cache.has(cle)) {
    const lu = fetch(`${BASE}eau_${cle}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<FichierEau>) : null))
      .then((f) => (f ? lirePoints(f) : []))
      .catch(() => { cache.delete(cle); return []; }); // nouvel essai plus tard
    cache.set(cle, lu);
  }
  return cache.get(cle)!;
}

/** Points d'eau des cases autour du tracé. */
export async function pointsEauAutour(trace: Position[]): Promise<PointEau[]> {
  return (await Promise.all(casesAutour(trace).map(lireCase))).flat();
}
