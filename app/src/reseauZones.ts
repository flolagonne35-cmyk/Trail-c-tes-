// Chargement du réseau de voies d'une zone (pour les boucles), à la demande.
//
// Chaque zone a son fichier (assets/data/reseau/<nom>.reseau, voir scripts/index_reseaux.py) :
// l'appli ne lit que celui du départ et n'en garde qu'un en mémoire (≈ 50 Mo par métropole une fois
// le graphe construit), ce qui permet d'ajouter des zones sans alourdir le téléphone.

import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import type { Position } from "./calcul/geo.ts";
import { construireGraphe, zoneContenant, type Graphe, type ReseauBrut } from "./calcul/reseau.ts";
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
