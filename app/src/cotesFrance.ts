// Côtes de toute la France, chargées par département autour du point de départ.
//
// Le précalcul (workflow « Précalcul des côtes (France) ») range un fichier par département sur le
// site de l'appli (Cloudflare Pages, dossier /cotes/) avec un index.json (emprise, nombre de côtes,
// fichiers). L'appli ne charge que les départements à moins de RAYON_KM du départ ; les côtes de
// Rennes et Nantes embarquées servent quand il n'y a pas de réseau.

import { Platform } from "react-native";

import { emprisesProches, type IndexDepartements } from "./calcul/departements.ts";
import type { Cote } from "./calcul/cotes.ts";
import type { Position } from "./calcul/geo.ts";

const BASE = Platform.OS === "web" ? "/cotes/" : "https://trail-cotes.pages.dev/cotes/";
export const RAYON_KM = 40;

let index: Promise<IndexDepartements | null> | null = null;
const fichiers = new Map<string, Promise<Cote[]>>();

async function lireJson<T>(nom: string): Promise<T | null> {
  try {
    const r = await fetch(BASE + nom);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null; // pas de réseau, ou version de test sans données : on garde les côtes embarquées
  }
}

/** Côtes des départements autour du point, et les emprises de ces départements. */
export async function cotesAutour(p: Position): Promise<{ cotes: Cote[]; emprises: number[][] }> {
  index ??= lireJson<IndexDepartements>("index.json");
  const idx = await index;
  if (!idx) {
    index = null; // nouvel essai au prochain déplacement
    return { cotes: [], emprises: [] };
  }
  const deps = emprisesProches(idx, p, RAYON_KM);
  const listes = await Promise.all(deps.flatMap((d) => idx.departements[d].fichiers.map((f) => {
    if (!fichiers.has(f)) {
      const lu = lireJson<{ cotes: Cote[] }>(f).then((x) => x?.cotes ?? []);
      lu.then((c) => { if (!c.length) fichiers.delete(f); });
      fichiers.set(f, lu);
    }
    return fichiers.get(f)!;
  })));
  return { cotes: listes.flat(), emprises: deps.map((d) => idx.departements[d].emprise) };
}
