// Logements et gares autour d'une course (OpenStreetMap, API Overpass), avec un serveur de secours ;
// sans connexion : liste vide et liens de réservation seulement.

import { lireOverpass, requeteOverpass, type Gare, type Logement } from "./calcul/voyage.ts";
import type { Position } from "./calcul/geo.ts";

const SERVEURS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const cache = new Map<string, Promise<{ logements: Logement[]; gares: Gare[] } | null>>();

export function autourDeLaCourse(p: Position): Promise<{ logements: Logement[]; gares: Gare[] } | null> {
  const cle = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
  if (!cache.has(cle)) {
    const lu = (async () => {
      for (const url of SERVEURS) {
        const controle = new AbortController();
        const minuteur = setTimeout(() => controle.abort(), 25000);
        try {
          const r = await fetch(url, { method: "POST", signal: controle.signal,
                                       headers: { "Content-Type": "application/x-www-form-urlencoded" },
                                       body: `data=${encodeURIComponent(requeteOverpass(p))}` });
          if (r.ok) return lireOverpass(await r.json(), p);
        } catch { /* serveur suivant */ } finally { clearTimeout(minuteur); }
      }
      cache.delete(cle); // on réessaiera
      return null;
    })();
    cache.set(cle, lu);
  }
  return cache.get(cle)!;
}
