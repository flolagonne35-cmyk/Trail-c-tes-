// Services publics de la Géoplateforme (sans clé) :
// - géocodage : adresse ou ville → position, et position → adresse (Base Adresse Nationale, BD TOPO) ;
//   50 requêtes par seconde au plus ;
// - calcul d'itinéraire : voiture et piéton (moteur OSRM sur la BD TOPO).
// Docs : cartes.gouv.fr/aide → Géocodage, Calcul d'itinéraire.

import type { Position } from "./geo.ts";

const GEOCODAGE = "https://data.geopf.fr/geocodage";
const ITINERAIRE = "https://data.geopf.fr/navigation/itineraire";

export type Lieu = Position & { label: string; detail: string };
export type Trajet = { distance_m: number; duree_min: number };

type Feature = { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> };

const texte = (v: unknown) => (typeof v === "string" ? v : "");

/** Réponse de /geocodage/search (GeoJSON) → lieux. */
export function lireRecherche(json: { features?: Feature[] }): Lieu[] {
  return (json.features ?? []).flatMap((f) => {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const label = texte(p.label) || texte(p.name) || texte(p.toponym);
    const detail = [texte(p.postcode) || (Array.isArray(p.postcode) ? String(p.postcode[0]) : ""),
                    texte(p.city) || (Array.isArray(p.city) ? String(p.city[0]) : "")].filter(Boolean).join(" ");
    return label ? [{ lat, lon, label, detail: detail && !label.includes(detail) ? detail : "" }] : [];
  });
}

/** Réponse de /geocodage/reverse → adresse la plus proche (« 12 Rue Gambetta 35000 Rennes »). */
export function lireAdresse(json: { features?: Feature[] }): string | null {
  const p = json.features?.[0]?.properties;
  return p ? texte(p.label) || null : null;
}

/** Réponse de /navigation/itineraire (distance en mètres, durée en minutes demandées). */
export function lireItineraire(json: { distance?: unknown; duration?: unknown }): Trajet | null {
  const distance = Number(json.distance);
  const duree = Number(json.duration);
  return Number.isFinite(distance) && Number.isFinite(duree) ? { distance_m: distance, duree_min: duree } : null;
}

async function obtenir(url: string, delaiMs = 8000): Promise<unknown> {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delaiMs);
  try {
    const r = await fetch(url, { signal: controle.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(minuteur);
  }
}

/** Villes, adresses et lieux nommés ; `pres` favorise les résultats proches. */
export async function rechercherLieux(q: string, pres?: Position): Promise<Lieu[]> {
  const params = new URLSearchParams({ q, limit: "6", index: "address,poi", autocomplete: "1" });
  if (pres) {
    params.set("lat", pres.lat.toFixed(5));
    params.set("lon", pres.lon.toFixed(5));
  }
  return lireRecherche((await obtenir(`${GEOCODAGE}/search?${params}`)) as { features?: Feature[] });
}

const cacheAdresses = new Map<string, Promise<string | null>>();

export function adresseDe(p: Position): Promise<string | null> {
  const cle = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  if (!cacheAdresses.has(cle)) {
    const params = new URLSearchParams({ lat: p.lat.toFixed(6), lon: p.lon.toFixed(6), index: "address", limit: "1" });
    cacheAdresses.set(cle, obtenir(`${GEOCODAGE}/reverse?${params}`)
      .then((j) => lireAdresse(j as { features?: Feature[] }))
      .catch(() => {
        cacheAdresses.delete(cle); // on réessaiera
        return null;
      }));
  }
  return cacheAdresses.get(cle)!;
}

export async function itineraire(depart: Position, arrivee: Position, profil: "car" | "pedestrian"): Promise<Trajet | null> {
  const params = new URLSearchParams({
    resource: "bdtopo-osrm", profile: profil, optimization: "fastest",
    start: `${depart.lon.toFixed(6)},${depart.lat.toFixed(6)}`, end: `${arrivee.lon.toFixed(6)},${arrivee.lat.toFixed(6)}`,
    distanceUnit: "meter", timeUnit: "minute", getSteps: "false", geometryFormat: "geojson",
  });
  try {
    return lireItineraire((await obtenir(`${ITINERAIRE}?${params}`)) as { distance?: unknown; duration?: unknown });
  } catch {
    return null;
  }
}
