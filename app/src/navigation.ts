// « Y aller » (retour du 24/11 : « ça doit ouvrir Maps ou Waze, selon qu'on y va en voiture ou à
// pied ») : lien d'itinéraire vers l'application choisie, avec le mode de déplacement. Les liens
// universels s'ouvrent dans l'application installée, sinon dans le navigateur.
// Google Maps : https://developers.google.com/maps/documentation/urls/get-started
// Waze : https://developers.google.com/waze/deeplinks
// Plans d'Apple : https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";

import type { Position } from "./calcul/geo.ts";

export type AppliNav = "google" | "waze" | "apple";
export type ModeNav = "voiture" | "pied" | "velo";
export type PrefNav = { appli: AppliNav; mode: ModeNav };

export const NOMS_APPLIS: Record<AppliNav, string> = { google: "Google Maps", waze: "Waze", apple: "Plans (Apple)" };
export const NOMS_MODES_NAV: Record<ModeNav, string> = { voiture: "En voiture", pied: "À pied", velo: "À vélo" };

/** Plans d'Apple n'existe que sur iPhone, iPad et Mac ; Waze ne guide qu'en voiture. */
export function applisDisponibles(): AppliNav[] {
  const apple = Platform.OS === "ios" || (Platform.OS === "web" && typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent));
  return apple ? ["google", "waze", "apple"] : ["google", "waze"];
}

export function lienItineraire(p: Position, { appli, mode }: PrefNav): string {
  const ll = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  if (appli === "waze") return `https://waze.com/ul?ll=${ll}&navigate=yes`;
  if (appli === "apple") return `https://maps.apple.com/?daddr=${ll}&dirflg=${mode === "voiture" ? "d" : mode === "pied" ? "w" : "c"}`;
  const t = mode === "voiture" ? "driving" : mode === "pied" ? "walking" : "bicycling";
  return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=${t}`;
}

const CLE = "trailcotes.navigation.v1";
export async function chargerPrefNav(): Promise<PrefNav | null> {
  try {
    const b = await AsyncStorage.getItem(CLE);
    return b ? (JSON.parse(b) as PrefNav) : null;
  } catch {
    return null;
  }
}
export function enregistrerPrefNav(p: PrefNav): void {
  AsyncStorage.setItem(CLE, JSON.stringify(p)).catch(() => undefined);
}
export const ouvrirItineraire = (p: Position, pref: PrefNav) => Linking.openURL(lienItineraire(p, pref)).catch(() => undefined);
