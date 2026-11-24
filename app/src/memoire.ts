// Réglages d'écran gardés le temps de la session (retour du 24/11 : « retourner en arrière sans
// perdre ma page ») : un écran quitté puis rouvert retrouve ses filtres et ses choix.

import { useState } from "react";

const memoire = new Map<string, unknown>();

/** Comme useState, mais la valeur survit quand l'écran est quitté puis rouvert. */
export function useEtatGarde<T>(cle: string, initial: T | (() => T)): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => (memoire.has(cle) ? (memoire.get(cle) as T)
    : typeof initial === "function" ? (initial as () => T)() : initial));
  const changer = (n: T) => { memoire.set(cle, n); setV(n); };
  return [v, changer];
}
