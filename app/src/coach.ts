// Coach côté appli : conversation gardée sur le téléphone, accord du coureur pour le coach en ligne
// (IA gratuite hébergée par Cloudflare), appel de la fonction serveur (/api/coach) et liens vers
// l'assistant IA du coureur. Sans accord, rien n'est envoyé : le coach intégré répond sur le téléphone.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { MessageCoach } from "./calcul/coach.ts";

const URL_COACH = Platform.OS === "web" ? "/api/coach" : "https://trail-cotes.pages.dev/api/coach";
const CLE = "trailcotes.coach.v1";

/** Message affiché : celui du coureur, ou une réponse avec sa provenance. */
export type MessageAffiche = MessageCoach & { source?: "integre" | "ia" };
export type EtatCoach = { accord: boolean; messages: MessageAffiche[] };

/** Assistants IA grand public qui acceptent une question pré-remplie dans l'adresse. */
export const ASSISTANTS: [string, (q: string) => string][] = [
  ["ChatGPT", (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`],
  ["Claude", (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`],
  ["Le Chat", (q) => `https://chat.mistral.ai/chat?q=${encodeURIComponent(q)}`],
];

/** Question prête à coller dans un assistant IA : le rôle, le résumé du coureur, la question. */
export const questionPreparee = (question: string, contexte: string) =>
  `Tu es un coach de course à pied et de trail. Réponds en français, simplement et en moins de 200 mots.\n\nMa situation :\n${contexte}\n\nMa question : ${question}`;
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

/** Réponse du coach en ligne, ou null (pas de réseau, quota gratuit épuisé, pas activé) : le coach intégré prend le relais. */
export async function demanderCoach(messages: MessageCoach[], contexte: string): Promise<string | null> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), 45000);
  try {
    const r = await fetch(URL_COACH, { method: "POST", signal: controle.signal, headers: { "Content-Type": "application/json" },
                                       body: JSON.stringify({ messages, contexte }) });
    const j = (await r.json().catch(() => null)) as { texte?: string } | null;
    return r.ok && j?.texte ? j.texte : null;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}
