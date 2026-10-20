// Mes courses de l'année, conservées sur le téléphone.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CourseInscrite } from "./calcul/calendrier.ts";

const CLE = "trailcotes.courses.v1";

export async function chargerCourses(): Promise<CourseInscrite[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as CourseInscrite[]) : [];
  } catch {
    return [];
  }
}

export function enregistrerCourses(c: CourseInscrite[]) {
  AsyncStorage.setItem(CLE, JSON.stringify(c)).catch(() => undefined);
}
