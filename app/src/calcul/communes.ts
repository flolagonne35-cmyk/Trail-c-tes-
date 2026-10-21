// Recherche de ville parmi toutes les communes de France, sans réseau.
// Données : scripts/telecharger_communes.py (geo.api.gouv.fr, Licence Ouverte), triées par population.

import type { Lieu } from "./geoservices.ts";

/** [nom, code postal, département, lat, lon, population] */
export type Commune = [string, string, string, number, number, number];

/** Minuscules, sans accents ni ponctuation, « saint » → « st ». */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[-'’.,/()]/g, " ")
    .replace(/\bsainte?\b/g, (m) => (m === "sainte" ? "ste" : "st"))
    .replace(/\s+/g, " ")
    .trim();
}

type Index = { communes: Commune[]; noms: string[] };
let index: Index | null = null;

export function indexer(communes: Commune[]): Index {
  return { communes, noms: communes.map((c) => normaliser(c[0])) };
}

function rang(nom: string, q: string): number {
  if (nom === q) return 0;
  if (nom.startsWith(q)) return 1;
  if (nom.split(" ").some((mot) => mot.startsWith(q))) return 2;
  if (nom.includes(q)) return 3;
  // tous les mots tapés commencent un mot du nom, dans n'importe quel ordre (« malo saint »)
  const mots = nom.split(" ");
  if (q.includes(" ") && q.split(" ").every((m) => mots.some((n) => n.startsWith(m)))) return 4;
  return -1;
}

/** Jusqu'à `limite` communes, les mieux correspondantes d'abord, puis les plus peuplées. */
export function chercherCommunes(texte: string, idx: Index, limite = 8): Lieu[] {
  const q = normaliser(texte);
  if (q.length < 2) return [];
  const resultats: { rang: number; i: number }[] = [];
  if (/^\d{2,5}$/.test(q)) {
    idx.communes.forEach((c, i) => { if (c[1].startsWith(q)) resultats.push({ rang: 1, i }); });
  } else {
    idx.noms.forEach((nom, i) => {
      const r = rang(nom, q);
      if (r >= 0) resultats.push({ rang: r, i });
    });
  }
  return resultats
    .sort((a, b) => a.rang - b.rang || a.i - b.i) // l'ordre d'origine est celui des populations
    .slice(0, limite)
    .map(({ i }) => {
      const [nom, cp, dep, lat, lon] = idx.communes[i];
      return { label: nom, detail: [cp, dep && `département ${dep}`].filter(Boolean).join(" · "), lat, lon };
    });
}

/** Index des communes de l'application, chargé à la première recherche. */
export function indexCommunes(): Index {
  if (!index) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const donnees = require("../../assets/data/communes.json") as { communes: Commune[] };
    index = indexer(donnees.communes);
  }
  return index;
}

/** Département de la commune la plus proche d'un point (« 35 ») ; "" si l'index est vide. */
export function departementPres(idx: Index, p: { lat: number; lon: number }): string {
  let meilleur = "";
  let dMin = Infinity;
  const cos = Math.cos((p.lat * Math.PI) / 180);
  for (const [, , dep, lat, lon] of idx.communes) {
    const d = (lat - p.lat) ** 2 + ((lon - p.lon) * cos) ** 2;
    if (d < dMin) { dMin = d; meilleur = dep; }
  }
  return meilleur;
}
