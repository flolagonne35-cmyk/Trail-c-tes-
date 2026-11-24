// Chargement du corps 3D (fichier préparé par scripts/avatar_corps.py), une seule fois par session.
// Web : servi avec le site (/avatar/corps.bin) ; téléphone : depuis le site de l'appli.

import { Platform } from "react-native";

import { lireCorps, type DonneesCorps } from "./corps.ts";

const URL_CORPS = Platform.OS === "web" ? "/avatar/corps.bin" : "https://trail-cotes.pages.dev/avatar/corps.bin";
let enCours: Promise<DonneesCorps | null> | null = null;

export function chargerCorps(): Promise<DonneesCorps | null> {
  enCours ??= fetch(URL_CORPS)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then(lireCorps)
    .catch(() => { enCours = null; return null; });
  return enCours;
}
