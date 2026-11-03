// Chargement du réseau de voies (pour les boucles), à la demande.
//
// France entière : blocs de ≈ 12 km publiés sur le site de l'appli (/reseau/, index.json), calculés
// par le workflow « Réseau des boucles (France) ». L'appli ne charge que les blocs à la distance
// utile pour la boucle demandée. Sans connexion, les réseaux embarqués de Rennes et Nantes servent.
//
// Chaque zone a son fichier (assets/data/reseau/<nom>.reseau, voir scripts/index_reseaux.py) :
// l'appli ne lit que celui du départ et n'en garde qu'un en mémoire (≈ 50 Mo par métropole une fois
// le graphe construit), ce qui permet d'ajouter des zones sans alourdir le téléphone.

import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import type { Position } from "./calcul/geo.ts";
import { blocsAutour, construireGraphe, fusionnerReseaux, rayonPourBoucle, zoneContenant,
  type Graphe, type IndexReseau, type ReseauBrut } from "./calcul/reseau.ts";
import { RESEAUX, type ReseauZone } from "./calcul/reseaux.ts";

let charge: { nom: string; graphe: Promise<Graphe> } | null = null;

export function zoneDuDepart(p: Position): ReseauZone | null {
  return zoneContenant(RESEAUX, p);
}

/** Libellés des zones couvertes, pour dire où les boucles sont possibles. */
export const ZONES_RESEAU = RESEAUX.map((z) => z.libelle);

async function lire(z: ReseauZone): Promise<string> {
  // version de test web autonome : les fichiers sont publiés à côté de la page
  if (Platform.OS === "web" && process.env.EXPO_PUBLIC_TUILES_LOCALES === "1") {
    return (await fetch(`reseau/${z.nom}.reseau`)).text();
  }
  const a = Asset.fromModule(z.fichier);
  await a.downloadAsync();
  if (Platform.OS === "web") return (await fetch(a.uri)).text();
  return new File(a.localUri ?? a.uri).text();
}

/** Graphe de la zone (lu et construit une seule fois tant qu'on reste dans la même zone). */
export function grapheDeZone(z: ReseauZone): Promise<Graphe> {
  if (charge?.nom !== z.nom) {
    const graphe = lire(z).then((t) => construireGraphe(JSON.parse(t) as ReseauBrut));
    graphe.catch(() => { if (charge?.nom === z.nom) charge = null; }); // nouvel essai la prochaine fois
    charge = { nom: z.nom, graphe };
  }
  return charge.graphe;
}

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
 * disponible ici (pas de connexion, ou pas encore calculé) : l'appeleur essaie alors les zones embarquées.
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
