// Trains directs entre chez toi et une course, un jour donné, à partir des horaires théoriques SNCF
// (GTFS ouvert, TGV INOUI, OUIGO, Intercités et TER), préparés par scripts/horaires_train.py :
// un même train qui passe par une gare proche de chez toi puis par une gare proche de la course,
// un jour où il circule, est un train direct.

import { distanceM, type Position } from "./geo.ts";

/**
 * [train, ordre, arrivée, départ, service, mode, numéro, drapeaux] ; heures en minutes depuis minuit
 * (> 1 440 après minuit) ; drapeaux : 1 = montée interdite, 2 = descente interdite à cet arrêt.
 */
export type Passage = [number, number, number, number, number, number, string, number?];
export type Services = { debut: string; jours: number; s: string[] };
export type GareHoraires = [string, string, number, number]; // uic, nom, lat, lon
export type TrainDirect = {
  numero: string; mode: string; depart: number; arrivee: number; duree: number;
  gareDepart: string; gareArrivee: string; accesDepart_m: number; accesArrivee_m: number;
};

export const NOMS_MODES = ["TER", "TGV INOUI", "OUIGO", "Intercités", "Car TER", "Train"];
const UN_JOUR = 86400000;

/** Numéro du jour (0 = premier jour publié) ; null si la date sort de la période publiée. */
export function indiceJour(s: Services, jourIso: string): number | null {
  const k = Math.round((Date.parse(`${jourIso}T12:00:00Z`) - Date.parse(`${s.debut}T12:00:00Z`)) / UN_JOUR);
  return k >= 0 && k < s.jours ? k : null;
}

/** Dernier jour publié (« AAAA-MM-JJ ») : les horaires couvrent environ 5 mois. */
export const dernierJour = (s: Services) => new Date(Date.parse(`${s.debut}T12:00:00Z`) + (s.jours - 1) * UN_JOUR).toISOString().slice(0, 10);

const cacheBits = new WeakMap<Services, bigint[]>();
/** Le service circule-t-il le jour k ? (bitmap hexadécimal : bit k = jour debut + k) */
export function circule(s: Services, service: number, k: number): boolean {
  let bits = cacheBits.get(s);
  if (!bits) { bits = s.s.map((h) => BigInt(`0x${h}`)); cacheBits.set(s, bits); }
  return k >= 0 && ((bits[service] >> BigInt(k)) & 1n) === 1n;
}

/** Gares à moins de `rayon` mètres, de la plus proche à la plus loin (au plus `n`). */
export function garesProches(gares: GareHoraires[], p: Position, rayon: number, n = 4): { uic: string; nom: string; d: number }[] {
  return gares.map(([uic, nom, lat, lon]) => ({ uic, nom, d: distanceM(p, { lat, lon }) }))
    .filter((g) => g.d <= rayon).sort((a, b) => a.d - b.d).slice(0, n);
}

/**
 * Trains directs le jour `jourIso` (départ de la gare de départ ce jour-là, heure locale), d'une
 * gare de `depart` vers une gare de `arrivee`. Un train de nuit parti la veille de son origine et
 * passant après minuit compte pour ce jour-là.
 */
export function trainsDirects(s: Services, jourIso: string,
                              depart: { nom: string; d: number; passages: Passage[] }[],
                              arrivee: { nom: string; d: number; passages: Passage[] }[]): TrainDirect[] {
  const k = indiceJour(s, jourIso);
  if (k === null) return [];
  const res = new Map<string, TrainDirect>();
  for (const a of arrivee) {
    const parTrain = new Map<number, Passage>();
    for (const p of a.passages) if (!((p[7] ?? 0) & 2)) parTrain.set(p[0], p);
    for (const g of depart) {
      for (const p of g.passages) {
        if ((p[7] ?? 0) & 1) continue; // on ne peut pas monter dans ce train ici
        const q = parTrain.get(p[0]);
        if (!q || q[1] <= p[1]) continue; // même train, dans le bon sens
        const jourService = p[3] >= 1440 ? k - 1 : k;
        if (!circule(s, p[4], jourService)) continue;
        const t: TrainDirect = { numero: p[6], mode: NOMS_MODES[p[5]] ?? "Train", depart: p[3] % 1440,
                                 arrivee: q[2] - (p[3] >= 1440 ? 1440 : 0), duree: q[2] - p[3],
                                 gareDepart: g.nom, gareArrivee: a.nom, accesDepart_m: g.d, accesArrivee_m: a.d };
        // un train vu depuis plusieurs gares proches : on garde la paire la plus proche de chez toi et de la course
        const cle = `${p[0]}`;
        const avant = res.get(cle);
        if (!avant || t.accesDepart_m + t.accesArrivee_m < avant.accesDepart_m + avant.accesArrivee_m) res.set(cle, t);
      }
    }
  }
  return [...res.values()].sort((x, y) => x.depart - y.depart);
}

/** « 7 h 05 » */
export const heure = (min: number) => `${Math.floor(min / 60) % 24} h ${String(min % 60).padStart(2, "0")}`;
