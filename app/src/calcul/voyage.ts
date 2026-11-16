// « Y aller et dormir » : coût du trajet en voiture, liens de covoiturage, de train et de
// réservation, gare et logements autour du départ (OpenStreetMap).
//
// - Coût voiture : distance de l'itinéraire IGN × consommation × prix moyen du carburant du jour
//   (flux officiel prix-carburants, publié chaque jour par le workflow du calendrier). Péages en plus
//   sur autoroute : leur montant dépend de la section, aucune source ouverte ne le donne.
// - Logements et gares : OpenStreetMap (© contributeurs OpenStreetMap, ODbL), via l'API Overpass.

import { distanceM, type Position } from "./geo.ts";

export type Carburants = { gazole: number; e10: number; sp95: number; source: string; date: string };
export type Carburant = "gazole" | "e10" | "sp95";
export const NOMS_CARBURANT: Record<Carburant, string> = { gazole: "Gazole", e10: "SP95-E10", sp95: "SP95" };

/** Coût du carburant pour un aller-retour, et par personne si l'on partage la voiture. */
export function coutVoiture(distanceAllerM: number, consoL100: number, prixL: number, personnes = 1) {
  const litres = ((distanceAllerM * 2) / 1000) * (consoL100 / 100);
  const total = litres * prixL;
  return { litres, total, parPersonne: total / Math.max(1, personnes) };
}

/** Veille de la course (on arrive la veille pour dormir sur place). */
export function veille(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Liens pré-remplis : covoiturage, train, hébergement (sans affiliation). */
export function liens(depart: string, commune: string, date: string) {
  const v = veille(date);
  const e = encodeURIComponent;
  return {
    covoiturage: `https://www.blablacar.fr/search?fn=${e(depart)}&tn=${e(commune)}&db=${v}`,
    train: "https://www.sncf-connect.com/",
    booking: `https://www.booking.com/searchresults.fr.html?ss=${e(commune)}&checkin=${v}&checkout=${date}&group_adults=1`,
    airbnb: `https://www.airbnb.fr/s/${e(commune)}/homes?checkin=${v}&checkout=${date}&adults=1`,
  };
}

export type TypeLogement = "hotel" | "camping" | "gite" | "chambre" | "auberge" | "refuge";
export const NOMS_LOGEMENT: Record<TypeLogement, string> = {
  hotel: "Hôtel", camping: "Camping", gite: "Gîte ou meublé", chambre: "Chambre d'hôtes", auberge: "Auberge de jeunesse", refuge: "Refuge",
};
const TYPES_OSM: Record<string, TypeLogement> = {
  hotel: "hotel", motel: "hotel", camp_site: "camping", caravan_site: "camping", chalet: "gite", apartment: "gite",
  guest_house: "chambre", hostel: "auberge", alpine_hut: "refuge", wilderness_hut: "refuge",
};

export type Logement = Position & { nom: string; type: TypeLogement; distance_m: number; site?: string; etoiles?: number; tel?: string };
export type Gare = Position & { nom: string; distance_m: number };

/** Requête Overpass : hébergements à `rayonM` du départ et gares à 25 km. */
export function requeteOverpass(p: Position, rayonM = 8000): string {
  const types = Object.keys(TYPES_OSM).join("|");
  return `[out:json][timeout:25];(nwr["tourism"~"^(${types})$"](around:${rayonM},${p.lat},${p.lon});`
    + `nwr["railway"="station"]["usage"!~"tourism"](around:25000,${p.lat},${p.lon}););out center tags 300;`;
}

type ElementOsm = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/** Réponse Overpass → logements (nommés, du plus proche au plus loin) et gares (la plus proche d'abord). */
export function lireOverpass(json: { elements?: ElementOsm[] }, depart: Position): { logements: Logement[]; gares: Gare[] } {
  const logements: Logement[] = [];
  const gares: Gare[] = [];
  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const t = el.tags ?? {};
    if (lat === undefined || lon === undefined || !t.name) continue;
    const d = distanceM(depart, { lat, lon });
    if (t.railway === "station") { gares.push({ lat, lon, nom: t.name, distance_m: d }); continue; }
    const type = TYPES_OSM[t.tourism ?? ""];
    if (!type) continue;
    const etoiles = parseInt(t.stars ?? "", 10);
    logements.push({ lat, lon, nom: t.name, type, distance_m: d, site: t.website ?? t["contact:website"] ?? undefined,
                     etoiles: Number.isFinite(etoiles) ? etoiles : undefined, tel: t.phone ?? t["contact:phone"] ?? undefined });
  }
  return { logements: logements.sort((a, b) => a.distance_m - b.distance_m), gares: gares.sort((a, b) => a.distance_m - b.distance_m) };
}
