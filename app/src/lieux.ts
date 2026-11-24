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

// Lieux favoris (maison, club, lieu de vacances…), marqués d'une étoile dans la recherche : sans limite
// de nombre, en tête de liste, gardés sur le téléphone.
const CLE_FAVORIS = "trailcotes.favoris.v1";
const memeLieu = (a: Lieu, b: Lieu) => a.label === b.label && a.detail === b.detail;

export async function chargerFavoris(): Promise<Lieu[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_FAVORIS);
    return brut ? (JSON.parse(brut) as Lieu[]) : [];
  } catch {
    return [];
  }
}

/** Ajoute ou retire le lieu des favoris et renvoie la nouvelle liste. */
export function basculerFavori(favoris: Lieu[], l: Lieu): Lieu[] {
  const liste = favoris.some((f) => memeLieu(f, l)) ? favoris.filter((f) => !memeLieu(f, l)) : [...favoris, l];
  AsyncStorage.setItem(CLE_FAVORIS, JSON.stringify(liste)).catch(() => undefined);
  return liste;
}

export const estFavori = (favoris: Lieu[], l: Lieu) => favoris.some((f) => memeLieu(f, l));
