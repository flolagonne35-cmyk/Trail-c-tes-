// Mes chiffres de nutrition (tests de pesée, profil de sel), conservés sur le téléphone uniquement :
// le poids est une donnée personnelle, rien n'est envoyé.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ProfilSel, TestSudation } from "./calcul/sudation.ts";

const CLE = "trailcotes.chiffres.v1";
export type MesChiffres = { tests: TestSudation[]; sel: ProfilSel | null; produits?: string[] };
export const CHIFFRES_VIDES: MesChiffres = { tests: [], sel: null };

export async function chargerChiffres(): Promise<MesChiffres> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? { ...CHIFFRES_VIDES, ...(JSON.parse(brut) as MesChiffres) } : CHIFFRES_VIDES;
  } catch {
    return CHIFFRES_VIDES;
  }
}

export function enregistrerChiffres(c: MesChiffres) {
  AsyncStorage.setItem(CLE, JSON.stringify(c)).catch(() => undefined);
}
