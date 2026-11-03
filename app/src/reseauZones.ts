// Réseau des voies de toute la France (pour les boucles), chargé à la demande autour du départ.
//
// Blocs de ≈ 12 km publiés sur le site de l'appli (/reseau/, index.json), calculés par le workflow
// « Réseau des boucles (France) ». L'appli ne charge que les blocs à la distance utile pour la
// boucle demandée, et garde le dernier graphe construit tant qu'on reste dans la même zone.

import { Platform } from "react-native";

import type { Position } from "./calcul/geo.ts";
import { blocsAutour, construireGraphe, fusionnerReseaux, rayonPourBoucle,
  type Graphe, type IndexReseau, type ReseauBrut } from "./calcul/reseau.ts";

const BASE = Platform.OS === "web" ? "/reseau/" : "https://trail-cotes.pages.dev/reseau/";
let index: Promise<IndexReseau | null> | null = null;
let france: { cle: string; graphe: Promise<Graphe> } | null = null;

async function lireJson<T>(nom: string): Promise<T> {
  const r = await fetch(BASE + nom);
  if (!r.ok) throw new Error(`réseau ${nom} : HTTP ${r.status}`);
  return (await r.json()) as T;
}

/**
 * Réseau autour du départ pour une boucle de `km` (blocs France), ou null si le réseau n'est pas
 * disponible ici (pas de connexion, ou hors de France).
 */
export async function grapheAutour(p: Position, km: number): Promise<Graphe | null> {
  index ??= lireJson<IndexReseau>("index.json").catch(() => null);
  const idx = await index;
  if (!idx) { index = null; return null; } // nouvel essai la prochaine fois
  const fichiers = blocsAutour(idx, p, rayonPourBoucle(km)).sort();
  if (!fichiers.length) return null;
  const cle = fichiers.join("|");
  if (france?.cle !== cle) {
    const graphe = Promise.all(fichiers.map((f) => lireJson<ReseauBrut>(f)))
      .then((blocs) => construireGraphe(fusionnerReseaux(blocs)));
    graphe.catch(() => { if (france?.cle === cle) france = null; });
    france = { cle, graphe };
  }
  return france.graphe.catch(() => null);
}
