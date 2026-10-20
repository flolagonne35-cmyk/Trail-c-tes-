// Lieux récemment choisis dans la recherche (villes, adresses), conservés sur le téléphone.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Lieu } from "./calcul/geoservices.ts";

const CLE = "trailcotes.lieux.v1";
const MAX = 5;

export async function chargerRecents(): Promise<Lieu[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Lieu[]) : [];
  } catch {
    return [];
  }
}

/** Ajoute le lieu en tête de liste (sans doublon) et renvoie la nouvelle liste. */
export function ajouterRecent(recents: Lieu[], l: Lieu): Lieu[] {
  const liste = [l, ...recents.filter((r) => r.label !== l.label || r.detail !== l.detail)].slice(0, MAX);
  AsyncStorage.setItem(CLE, JSON.stringify(liste)).catch(() => undefined);
  return liste;
}
