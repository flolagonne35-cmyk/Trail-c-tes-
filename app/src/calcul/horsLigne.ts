// « Garder cette zone hors connexion » : la liste des fichiers à mettre de côté pour que côtes,
// boucles, points d'eau et carte marchent sans réseau autour d'un départ. Les mêmes règles que les
// chargements en ligne, pour que l'appli, hors connexion, ne demande que des fichiers gardés.

import { emprisesProches, type IndexDepartements } from "./departements.ts";
import { casesAutour } from "./eau.ts";
import type { Position } from "./geo.ts";
import { blocsAutour, rayonPourBoucle, type IndexReseau } from "./reseau.ts";
import { SOURCE_IGN, tuilesZone } from "./tuiles.ts";

/** Boucles jusqu'à 30 km (≈ 3 h) sans réseau ; carte détaillée à 5 km du départ. */
export const BOUCLE_MAX_KM = 30;
export const RAYON_CARTE_M = 5000;
export const ZOOMS_CARTE: [number, number] = [11, 16];
/** Rayon de chargement des côtes en ligne (src/cotesFrance.ts). */
export const RAYON_COTES_KM = 40;

export function urlsZone(centre: Position, idxCotes: IndexDepartements | null, idxReseau: IndexReseau | null): string[] {
  const urls: string[] = [];
  if (idxCotes) {
    urls.push("/cotes/index.json");
    for (const d of emprisesProches(idxCotes, centre, RAYON_COTES_KM)) urls.push(...idxCotes.departements[d].fichiers.map((f) => `/cotes/${f}`));
  }
  const rayon = rayonPourBoucle(BOUCLE_MAX_KM);
  if (idxReseau) {
    urls.push("/reseau/index.json");
    urls.push(...blocsAutour(idxReseau, centre, rayon).map((f) => `/reseau/${f}`));
  }
  // points d'eau : toutes les cases que peut toucher une boucle partie d'ici
  const dLat = rayon / 111.2;
  const dLon = rayon / (111.2 * Math.cos((centre.lat * Math.PI) / 180));
  const coins = [{ lat: centre.lat - dLat, lon: centre.lon - dLon }, { lat: centre.lat + dLat, lon: centre.lon + dLon }];
  urls.push(...casesAutour(coins).map((c) => `/eau/eau_${c}.json`));
  urls.push(...tuilesZone(centre, RAYON_CARTE_M, ...ZOOMS_CARTE).map(([z, x, y]) => SOURCE_IGN.url(z, x, y)));
  return [...new Set(urls)];
}

/** « 48 Mo », « 850 ko ». */
export const tailleLisible = (octets: number) =>
  octets >= 1e6 ? `${Math.round(octets / 1e6)} Mo` : `${Math.max(1, Math.round(octets / 1e3))} ko`;
