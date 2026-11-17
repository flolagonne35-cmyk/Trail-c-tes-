// Coach IA côté appli : appel de la fonction serveur (/api/coach), accord du coureur et conversation
// gardés sur le téléphone. Rien n'est envoyé tant que le coureur n'a pas donné son accord.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { MessageCoach } from "./calcul/coach.ts";

const URL_COACH = Platform.OS === "web" ? "/api/coach" : "https://trail-cotes.pages.dev/api/coach";
const CLE = "trailcotes.coach.v1";

export type EtatCoach = { accord: boolean; messages: MessageCoach[] };
export const COACH_VIDE: EtatCoach = { accord: false, messages: [] };

export async function chargerCoach(): Promise<EtatCoach> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    return brut ? { ...COACH_VIDE, ...(JSON.parse(brut) as EtatCoach) } : COACH_VIDE;
  } catch {
    return COACH_VIDE;
  }
}
export function enregistrerCoach(e: EtatCoach) {
  AsyncStorage.setItem(CLE, JSON.stringify(e)).catch(() => undefined);
}

/** Réponse du coach, ou une erreur lisible (pas de réseau, coach pas activé, trop de messages). */
export async function demanderCoach(messages: MessageCoach[], contexte: string): Promise<{ texte: string } | { erreur: string }> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), 90000);
  try {
    const r = await fetch(URL_COACH, { method: "POST", signal: controle.signal, headers: { "Content-Type": "application/json" },
                                       body: JSON.stringify({ messages, contexte }) });
    const j = (await r.json().catch(() => null)) as { texte?: string; erreur?: string } | null;
    if (r.ok && j?.texte) return { texte: j.texte };
    return { erreur: j?.erreur ?? ([404, 405, 501].includes(r.status) ? "Le coach n'est pas encore activé sur ce site." : "Le coach ne répond pas : réessaie.") };
  } catch {
    return { erreur: "Pas de réponse : vérifie ta connexion internet, puis réessaie." };
  } finally {
    clearTimeout(minuteur);
  }
}
