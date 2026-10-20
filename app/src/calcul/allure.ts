// Mon allure réelle selon la pente, apprise de mes sorties GPX, pour prévoir mes temps.
//
// Chaque sortie est découpée en tronçons de 100 m ; pour chacun on note la pente et le temps.
// On cumule par tranche de pente de 5 % (−20 % … +25 %). Les tranches peu courues (< 500 m) sont
// complétées par le coût énergétique de Minetti (2002), recalé sur les tranches connues.
// Limite : la fatigue des très longues courses n'est pas modélisée (on court plus lentement en fin
// d'ultra qu'en sortie d'entraînement).

import { distanceM } from "./geo.ts";
import { coutMinetti } from "./nutrition.ts";
import type { Parcours } from "./profil.ts";

/** Tranche de pente (en %, multiple de 5) → [mètres courus, secondes]. */
export type Allures = Record<string, [number, number]>;

export const TRANCHES = [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25];
const MINIMUM_M = 500;
const tranche = (pentePct: number) => String(Math.max(-20, Math.min(25, Math.round(pentePct / 5) * 5)));

export function alluresDeTrace(lat: number[], lon: number[], ele: (number | null)[], temps: (number | null)[], pasM = 100): Allures {
  const res: Allures = {};
  let debut = 0;
  let parcouru = 0;
  for (let i = 1; i < lat.length; i++) {
    parcouru += distanceM({ lat: lat[i - 1], lon: lon[i - 1] }, { lat: lat[i], lon: lon[i] });
    if (parcouru < pasM) continue;
    const t0 = temps[debut];
    const t1 = temps[i];
    const z0 = ele[debut];
    const z1 = ele[i];
    if (t0 !== null && t1 !== null && z0 !== null && z1 !== null && t1 > t0) {
      const s = (t1 - t0) / 1000;
      const vitesseKmh = (parcouru / s) * 3.6;
      // arrêts, marche très lente ou GPS qui saute : écartés
      if (vitesseKmh >= 2 && vitesseKmh <= 25) {
        const cle = tranche(((z1 - z0) / parcouru) * 100);
        const [m, sec] = res[cle] ?? [0, 0];
        res[cle] = [m + parcouru, sec + s];
      }
    }
    debut = i;
    parcouru = 0;
  }
  return res;
}

export function fusionner(liste: (Allures | undefined)[]): Allures {
  const res: Allures = {};
  for (const a of liste) {
    for (const [k, [m, s]] of Object.entries(a ?? {})) {
      const [m0, s0] = res[k] ?? [0, 0];
      res[k] = [m0 + m, s0 + s];
    }
  }
  return res;
}

export type Modele = {
  secondesParMetre: (pentePct: number) => number;
  connues: number[]; // tranches mesurées (≥ 500 m)
  metres: number;
};

/** Modèle d'allure, ou null si moins de 500 m courus dans au moins une tranche. */
export function modeleAllure(a: Allures): Modele | null {
  const connues = TRANCHES.filter((t) => (a[String(t)]?.[0] ?? 0) >= MINIMUM_M);
  if (!connues.length) return null;
  // recalage de Minetti : allure du plat « équivalente » de chaque tranche connue, moyenne pondérée
  let poids = 0;
  let somme = 0;
  for (const t of connues) {
    const [m, s] = a[String(t)];
    somme += (s / m) * (coutMinetti(0) / coutMinetti(t / 100)) * m;
    poids += m;
  }
  const plat = somme / poids; // secondes par mètre sur le plat
  const pace = (t: number) => {
    const v = a[String(t)];
    return v && v[0] >= MINIMUM_M ? v[1] / v[0] : plat * (coutMinetti(t / 100) / coutMinetti(0));
  };
  return {
    connues, metres: Object.values(a).reduce((x, [m]) => x + m, 0),
    secondesParMetre: (p) => {
      const q = Math.max(-20, Math.min(25, p));
      const bas = Math.floor(q / 5) * 5;
      const haut = Math.min(25, bas + 5);
      const f = haut === bas ? 0 : (q - bas) / 5;
      return pace(bas) * (1 - f) + pace(haut) * f;
    },
  };
}

/** Temps prévu (heures) sur un parcours avec mon modèle d'allure. */
export function tempsPrevu(parcours: Parcours, modele: Modele): number {
  const d = parcours.profil.d_km.map((v) => v * 1000);
  const z = parcours.profil.z_m;
  let s = 0;
  for (let i = 1; i < d.length; i++) {
    const dx = d[i] - d[i - 1];
    if (dx <= 0) continue;
    s += dx * modele.secondesParMetre(((z[i] - z[i - 1]) / dx) * 100);
  }
  return s / 3600;
}

/** « 5:30 » min/km pour s secondes par mètre. */
export function allureLisible(sParM: number): string {
  const s = Math.round(sParM * 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
