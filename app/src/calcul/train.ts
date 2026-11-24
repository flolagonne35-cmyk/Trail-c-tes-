// Prix du train vers une course : données ouvertes SNCF (tarifs TGV INOUI, OUIGO et Intercités,
// licence ODbL), préparées par scripts/tarifs_train.py dans public/trains/tarifs.json.
// On cherche les gares à moins de 40 km de chez toi et du départ de la course, puis le trajet
// direct qui demande le moins de route pour rejoindre les gares (à vol d'oiseau).
// Prix publiés : plein tarif 2de classe, la fourchette selon le jour et l'heure de réservation.

import { distanceM, type Position } from "./geo.ts";

export type Tarifs = {
  source: string; date: string;
  gares: [string, string, number, number][]; // uic, nom, lat, lon
  trajets: [number, number, number, number, number][]; // gare i, gare j (i < j), prix min, prix max, types
};
export type OffreTrain = {
  gareDepart: string; gareArrivee: string; accesDepart_m: number; accesArrivee_m: number;
  prixMin: number; prixMax: number; transporteurs: string[];
};

/** Distance maximale jusqu'à une gare (au-delà, la voiture jusqu'à la gare devient le gros du trajet). */
export const RAYON_GARE_M = 40000;
const NOMS_TYPES: [number, string][] = [[1, "TGV INOUI"], [2, "OUIGO"], [4, "Intercités"]];

export const transporteurs = (masque: number) => NOMS_TYPES.filter(([b]) => masque & b).map(([, nom]) => nom);

function garesProches(t: Tarifs, p: Position, rayon: number): { i: number; d: number }[] {
  const res: { i: number; d: number }[] = [];
  t.gares.forEach(([, , lat, lon], i) => {
    const d = distanceM(p, { lat, lon });
    if (d <= rayon) res.push({ i, d });
  });
  return res.sort((a, b) => a.d - b.d).slice(0, 8);
}

// Paris : les gares d'un même trajet changent selon le transporteur (TGV INOUI à Montparnasse,
// OUIGO Train Classique à Austerlitz, par exemple) ; le nom exact serait trompeur.
const nomGare = (nom: string) => (/^Paris /.test(nom) ? "Paris (gare selon le train)" : nom);

/** Le meilleur train direct entre deux lieux, ou null s'il n'y en a pas (correspondance ou TER). */
export function trainDirect(t: Tarifs, depart: Position, arrivee: Position, rayon = RAYON_GARE_M): OffreTrain | null {
  const a = garesProches(t, depart, rayon);
  const b = garesProches(t, arrivee, rayon);
  if (!a.length || !b.length) return null;
  const index = new Map<string, Tarifs["trajets"][number]>();
  for (const tr of t.trajets) index.set(`${tr[0]}-${tr[1]}`, tr);
  let meilleur: OffreTrain | null = null;
  let cout = Infinity;
  for (const ga of a) {
    for (const gb of b) {
      if (ga.i === gb.i) continue;
      const tr = index.get(ga.i < gb.i ? `${ga.i}-${gb.i}` : `${gb.i}-${ga.i}`);
      if (!tr) continue;
      // on préfère les gares proches ; à accès égal, le moins cher
      const c = ga.d + gb.d + tr[2] * 50;
      if (c < cout) {
        cout = c;
        meilleur = { gareDepart: nomGare(t.gares[ga.i][1]), gareArrivee: nomGare(t.gares[gb.i][1]), accesDepart_m: ga.d, accesArrivee_m: gb.d,
                     prixMin: tr[2], prixMax: tr[3], transporteurs: transporteurs(tr[4]) };
      }
    }
  }
  return meilleur;
}
