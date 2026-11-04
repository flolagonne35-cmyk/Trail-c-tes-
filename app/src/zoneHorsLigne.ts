// Version web (PWA) : « Garder cette zone hors connexion ». Les fichiers de la zone (côtes, réseau
// des boucles, points d'eau, carte) sont mis dans un cache du navigateur que le service worker
// (public/sw.js) lit quand il n'y a pas de réseau. Rien ne quitte le téléphone.

import { useEffect, useState } from "react";
import { Platform } from "react-native";

import type { IndexDepartements } from "./calcul/departements.ts";
import type { Position } from "./calcul/geo.ts";
import { urlsZone } from "./calcul/horsLigne.ts";
import type { IndexReseau } from "./calcul/reseau.ts";

const CACHE = "zones-gardees";
const CLE_LISTE = "trail-cotes.zones-gardees";
const SIMULTANES = 3; // services publics partagés : peu de requêtes à la fois

export const ZONE_WEB_POSSIBLE = Platform.OS === "web" && typeof caches !== "undefined";

export type ZoneGardee = { nom: string; lat: number; lon: number; octets: number; date: string };

export function zonesGardees(): ZoneGardee[] {
  try { return JSON.parse(localStorage.getItem(CLE_LISTE) ?? "[]") as ZoneGardee[]; } catch { return []; }
}

function noter(z: ZoneGardee) {
  try {
    const autres = zonesGardees().filter((x) => x.nom !== z.nom);
    localStorage.setItem(CLE_LISTE, JSON.stringify([...autres, z]));
  } catch { /* stockage refusé (navigation privée) : la zone reste gardée, seule la liste manque */ }
}

async function lireIndex<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

/**
 * Met la zone de côté. `onProgres(faits, total)`. Renvoie le nombre de fichiers en échec et la place prise.
 * Les fichiers déjà gardés ne sont pas retéléchargés.
 */
export async function garderZone(centre: Position, nom: string, onProgres: (faits: number, total: number) => void,
                                 annule: () => boolean = () => false): Promise<{ echecs: number; echecsCarte: number; octets: number }> {
  const [idxCotes, idxReseau] = await Promise.all([
    lireIndex<IndexDepartements>("/cotes/index.json"), lireIndex<IndexReseau>("/reseau/index.json")]);
  if (!idxCotes && !idxReseau) return { echecs: 1, echecsCarte: 0, octets: 0 }; // pas de réseau
  const urls = urlsZone(centre, idxCotes, idxReseau);
  const cache = await caches.open(CACHE);
  let faits = 0; let echecs = 0; let echecsCarte = 0; let octets = 0; let suivante = 0;
  const travailleur = async () => {
    while (suivante < urls.length && !annule()) {
      const url = urls[suivante++];
      try {
        let r = await cache.match(url);
        if (!r) {
          // tuiles IGN en CORS : une vraie réponse, pas une réponse « opaque » qui gonfle le quota
          r = await fetch(url, url.startsWith("http") ? { mode: "cors" } : undefined);
          if (!r.ok) throw new Error(String(r.status));
          await cache.put(url, r.clone());
        }
        octets += (await r.blob()).size;
      } catch {
        if (url.startsWith("http")) echecsCarte++; else echecs++;
      }
      onProgres(++faits, urls.length);
    }
  };
  await Promise.all(Array.from({ length: SIMULTANES }, travailleur));
  if (!annule()) noter({ nom, lat: centre.lat, lon: centre.lon, octets, date: new Date().toISOString().slice(0, 10) });
  return { echecs, echecsCarte, octets };
}

/** Efface toutes les zones gardées. */
export async function oublierZones() {
  await caches.delete(CACHE);
  try { localStorage.removeItem(CLE_LISTE); } catch { /* rien à faire */ }
}

/** En ligne ou non (web) ; toujours vrai ailleurs. */
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState(Platform.OS !== "web" || typeof navigator === "undefined" || navigator.onLine !== false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const maj = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", maj);
    window.addEventListener("offline", maj);
    return () => { window.removeEventListener("online", maj); window.removeEventListener("offline", maj); };
  }, []);
  return enLigne;
}
