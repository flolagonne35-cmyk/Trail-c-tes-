// Profil du coureur (avatar, date de création du compte, sorties), conservé sur le téléphone.
// Les comptes en ligne (classement entre coureurs) viendront avec un serveur.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { migrerApparence, type Apparence } from "./avatar/modele.ts";
import type { Activite } from "./calcul/points.ts";

export type Profil = { prenom: string; apparence: Apparence; creeLe: string; activites: Activite[] };

const CLE = "trailcotes.profil.v1";

export async function chargerProfil(): Promise<Profil | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (!brut) return null;
    const p = JSON.parse(brut) as Profil;
    return { ...p, apparence: migrerApparence(p.apparence as never) }; // avatars de l'ancienne version
  } catch {
    return null;
  }
}

export async function enregistrerProfil(p: Profil): Promise<void> {
  await AsyncStorage.setItem(CLE, JSON.stringify(p));
}
