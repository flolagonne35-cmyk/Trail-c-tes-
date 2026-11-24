// Chargement des tarifs de train (préparés par scripts/tarifs_train.py), une fois par session.
// Web : servis avec le site ; téléphone : depuis le site de l'appli. Sans réseau : null.

import { Platform } from "react-native";

import type { Tarifs } from "./calcul/train.ts";

const URL_TARIFS = Platform.OS === "web" ? "/trains/tarifs.json" : "https://trail-cotes.pages.dev/trains/tarifs.json";
let enCours: Promise<Tarifs | null> | null = null;

export function chargerTarifs(): Promise<Tarifs | null> {
  enCours ??= fetch(URL_TARIFS)
    .then((r) => (r.ok ? (r.json() as Promise<Tarifs>) : Promise.reject(new Error(String(r.status)))))
    .catch(() => { enCours = null; return null; });
  return enCours;
}
