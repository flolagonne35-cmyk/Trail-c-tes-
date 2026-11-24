// Chargement des horaires de train (préparés chaque jour au déploiement par scripts/horaires_train.py) :
// la liste des gares et le calendrier une fois, puis seulement les gares utiles. Sans réseau : null.

import { Platform } from "react-native";

import type { GareHoraires, Passage, Services } from "./calcul/horaires.ts";

const BASE = Platform.OS === "web" ? "/trains/horaires/" : "https://trail-cotes.pages.dev/trains/horaires/";
const cache = new Map<string, Promise<unknown>>();

function lire<T>(fichier: string): Promise<T | null> {
  let p = cache.get(fichier) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(BASE + fichier).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
      .catch(() => { cache.delete(fichier); return null; });
    cache.set(fichier, p);
  }
  return p;
}

export const chargerServices = () => lire<Services>("services.json");
export const chargerGares = () => lire<GareHoraires[]>("gares.json");
export const chargerPassages = (uic: string) => lire<Passage[]>(`${uic}.json`);
