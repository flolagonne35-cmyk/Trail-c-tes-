// Ma course cible et mes réponses au questionnaire, conservées sur le téléphone.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CourseCible, Questionnaire } from "./calcul/plan.ts";

const CLE = "trailcotes.plan.v1";
export type MonPlan = { cible: CourseCible | null; questionnaire: Questionnaire | null };

export async function chargerPlan(): Promise<MonPlan> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as MonPlan) : { cible: null, questionnaire: null };
  } catch {
    return { cible: null, questionnaire: null };
  }
}

export function enregistrerPlan(p: MonPlan) {
  AsyncStorage.setItem(CLE, JSON.stringify(p)).catch(() => undefined);
}
