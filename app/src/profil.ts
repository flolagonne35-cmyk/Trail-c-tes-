// Profil du coureur (avatar, date de création du compte, sorties), conservé sur le téléphone.
// Les comptes en ligne (classement entre coureurs) viendront avec un serveur.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Activite } from "./calcul/points.ts";

export type Coupe = "courte" | "longue" | "queue" | "chignon" | "rasee";

export type Apparence = {
  silhouette: "femme" | "homme";
  peau: number;
  coupe: Coupe;
  cheveux: number;
  haut: number;
  bas: number;
  casquette: boolean;
  batons: boolean;
};

export type Profil = { prenom: string; apparence: Apparence; creeLe: string; activites: Activite[] };

export const PEAUX = ["#F6D7C3", "#E8B897", "#C98E66", "#9C6644", "#6B4430"];
export const CHEVEUX = ["#2B1D14", "#5A3825", "#A0522D", "#D9B26F", "#B7B7B7", "#C0392B"];
export const TENUES = ["#D9541E", "#2F6F9F", "#1B2A22", "#7A9A6A", "#E3B505", "#8E44AD", "#E84A7F", "#F4F1EA"];
export const COUPES: [Coupe, string][] = [
  ["courte", "Courte"], ["longue", "Longue"], ["queue", "Queue-de-cheval"], ["chignon", "Chignon"], ["rasee", "Rasée"],
];

export const APPARENCE_DEFAUT: Apparence = {
  silhouette: "femme", peau: 1, coupe: "queue", cheveux: 1, haut: 0, bas: 2, casquette: false, batons: true,
};

const CLE = "trailcotes.profil.v1";

export async function chargerProfil(): Promise<Profil | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Profil) : null;
  } catch {
    return null;
  }
}

export async function enregistrerProfil(p: Profil): Promise<void> {
  await AsyncStorage.setItem(CLE, JSON.stringify(p));
}
