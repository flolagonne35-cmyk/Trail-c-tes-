// Profil et segmentation montée / descente / plat. Port de scripts/segmenter_gpx.py et
// trailcotes/profil.py : mêmes seuils, mêmes résultats (vérifié par les tests).

import { interp } from "./geo.ts";

export type TypeSegment = "montée" | "descente" | "plat";
export const NIVEAUX = ["facile", "modérée", "difficile", "très difficile"] as const;

export type Segment = {
  n: number;
  type: TypeSegment;
  km_debut: number;
  km_fin: number;
  distance_km: number;
  dplus_m: number;
  dmoins_m: number;
  pente_moy_pct: number;
  pente_max_pct: number;
  alt_debut_m: number;
  alt_fin_m: number;
  difficulte: string;
  description: string;
};

export type Parcours = {
  nom: string;
  distance_km: number;
  dplus_m: number;
  dmoins_m: number;
  alt_max_m: number;
  alt_min_m: number;
  source_altitudes: string;
  nb_segments: number;
  segments: Segment[];
  profil: { d_km: number[]; z_m: number[] };
};

const arrondi = (v: number, n = 0) => Math.round(v * 10 ** n) / 10 ** n;

/** Lissage gaussien (comme scipy.ndimage.gaussian_filter1d, mode « nearest », troncature à 4 σ). */
export function lisser(z: number[], sigma: number): number[] {
  if (sigma <= 0) return z.slice();
  const r = Math.round(4 * sigma);
  const noyau: number[] = [];
  for (let k = -r; k <= r; k++) noyau.push(Math.exp((-0.5 * k * k) / (sigma * sigma)));
  const somme = noyau.reduce((a, b) => a + b, 0);
  const n = z.length;
  return z.map((_, i) => {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += noyau[k + r] * z[Math.min(n - 1, Math.max(0, i + k))];
    return acc / somme;
  });
}

/** Remplace les altitudes manquantes par interpolation linéaire. */
export function boucher(d: number[], z: (number | null)[]): number[] | null {
  const dk: number[] = [];
  const zk: number[] = [];
  z.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) {
      dk.push(d[i]);
      zk.push(v);
    }
  });
  if (dk.length < 2) return null;
  return d.map((s) => interp(s, dk, zk));
}

export function pentesParTranche(d: number[], z: number[], tranche = 50): number[] {
  const bornes: number[] = [];
  const fin = d[d.length - 1];
  for (let s = d[0]; s < fin; s += tranche) bornes.push(s);
  if (bornes.length > 1 && fin - bornes[bornes.length - 1] < tranche * 0.4) bornes.pop();
  bornes.push(fin);
  const zb = bornes.map((s) => interp(s, d, z));
  const p: number[] = [];
  for (let i = 1; i < bornes.length; i++) p.push(arrondi(((zb[i] - zb[i - 1]) / (bornes[i] - bornes[i - 1])) * 100, 1));
  return p;
}

export function penteCentree(d: number[], z: number[], fenetre: number): number[] {
  const d0 = d[0];
  const d1 = d[d.length - 1];
  return d.map((s) => {
    const a = Math.max(s - fenetre / 2, d0);
    const b = Math.min(s + fenetre / 2, d1);
    return b > a ? ((interp(b, d, z) - interp(a, d, z)) / (b - a)) * 100 : 0;
  });
}

const classer = (pente: number, seuil: number) => (pente > seuil ? 1 : pente < -seuil ? -1 : 0);

/** Segments [début, fin, type] contigus (type : 1 montée, −1 descente, 0 plat). */
export function segmenter(d: number[], z: number[], seuil = 3, fenetre = 200, longueurMin = 300) {
  const classes = penteCentree(d, z, fenetre).map((p) => classer(p, seuil));
  let segs: [number, number, number][] = [];
  let debut = 0;
  for (let i = 1; i < d.length; i++) {
    if (classes[i] !== classes[debut] || i === d.length - 1) {
      segs.push([debut, i, classes[debut]]);
      debut = i;
    }
  }
  const longueur = (s: [number, number, number]) => d[s[1]] - d[s[0]];
  const reclasser = (a: number, b: number) => classer(((z[b] - z[a]) / Math.max(d[b] - d[a], 1e-9)) * 100, seuil);
  const fusionnerVoisins = (liste: [number, number, number][]) => {
    const out = [liste[0]];
    for (const s of liste.slice(1)) {
      const dernier = out[out.length - 1];
      if (s[2] === dernier[2]) out[out.length - 1] = [dernier[0], s[1], s[2]];
      else out.push(s);
    }
    return out;
  };
  segs = fusionnerVoisins(segs);
  while (segs.length > 1) {
    const courts = segs.map((s, i) => i).filter((i) => longueur(segs[i]) < longueurMin);
    if (courts.length === 0) break;
    const i = courts.reduce((m, k) => (longueur(segs[k]) < longueur(segs[m]) ? k : m));
    const voisins = [i - 1, i + 1].filter((j) => j >= 0 && j < segs.length);
    const j = voisins.reduce((m, k) => (longueur(segs[k]) > longueur(segs[m]) ? k : m));
    const a = Math.min(segs[i][0], segs[j][0]);
    const b = Math.max(segs[i][1], segs[j][1]);
    segs[Math.min(i, j)] = [a, b, reclasser(a, b)];
    segs.splice(Math.max(i, j), 1);
    segs = fusionnerVoisins(segs);
  }
  return segs;
}

const moyenne = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const ecartType = (v: number[]) => {
  const m = moyenne(v);
  return Math.sqrt(moyenne(v.map((x) => (x - m) ** 2)));
};
/** Comme numpy.array_split en 3 morceaux. */
const enTrois = (v: number[]) => {
  const base = Math.floor(v.length / 3);
  const reste = v.length % 3;
  const tailles = [0, 1, 2].map((k) => base + (k < reste ? 1 : 0));
  return [v.slice(0, tailles[0]), v.slice(tailles[0], tailles[0] + tailles[1]), v.slice(tailles[0] + tailles[1])];
};

export function qualifier(type: number, d: number[], z: number[]): [string, string, number] {
  const L = d[d.length - 1] - d[0];
  const pente = L > 0 ? ((z[z.length - 1] - z[0]) / L) * 100 : 0;
  const tranches = L > 0 ? pentesParTranche(d, z) : [0];
  if (type === 0) {
    return ["facile", Math.abs(pente) < 1.5 ? "Roulant, relancer" : "Faux plat", Math.max(...tranches.map(Math.abs))];
  }
  const sens = type > 0 ? 1 : -1;
  const p = Math.abs(pente);
  const pmax = Math.max(...tranches.map((t) => sens * t));
  const bornes = sens > 0 ? [5, 8, 12] : [6, 12, 20];
  let niveau = bornes.filter((b) => p >= b).length;
  if (sens > 0 && z[z.length - 1] - z[0] > 600 && niveau < 3) niveau += 1;
  if (pmax > (sens > 0 ? 20 : 30) && niveau < 3) niveau += 1;
  const mots = [ecartType(tranches) < 2.5 ? "Régulière" : "Irrégulière"];
  if (tranches.length >= 3) {
    const tiers = enTrois(tranches).map((t) => Math.abs(moyenne(t)));
    const k = tiers.indexOf(Math.max(...tiers));
    if (tiers[k] > p + 2) mots.push((sens > 0 ? "raide" : "pentue") + [" en début", " au milieu", " en fin"][k]);
  }
  if (sens > 0 && p < 6) mots.push("roulante");
  if (sens < 0 && pmax > 20) mots.push("technique");
  return [NIVEAUX[niveau], mots.join(", "), pmax];
}

export function decrire(segs: [number, number, number][], d: number[], z: number[]): Segment[] {
  const TYPES: Record<number, TypeSegment> = { 1: "montée", [-1]: "descente", 0: "plat" };
  return segs.map(([a, b, t], i) => {
    const dd = d.slice(a, b + 1);
    const zz = z.slice(a, b + 1);
    let dplus = 0;
    let dmoins = 0;
    for (let k = 1; k < zz.length; k++) {
      const diff = zz[k] - zz[k - 1];
      if (diff > 0) dplus += diff;
      else dmoins -= diff;
    }
    const [difficulte, description, pmax] = qualifier(t, dd, zz);
    const L = dd[dd.length - 1] - dd[0];
    return {
      n: i + 1,
      type: TYPES[t],
      km_debut: arrondi(dd[0] / 1000, 2),
      km_fin: arrondi(dd[dd.length - 1] / 1000, 2),
      distance_km: arrondi(L / 1000, 2),
      dplus_m: Math.round(dplus),
      dmoins_m: Math.round(dmoins),
      pente_moy_pct: L > 0 ? arrondi(((zz[zz.length - 1] - zz[0]) / L) * 100, 1) : 0,
      pente_max_pct: arrondi(pmax, 1),
      alt_debut_m: Math.round(zz[0]),
      alt_fin_m: Math.round(zz[zz.length - 1]),
      difficulte,
      description,
    };
  });
}

/** Profil (d, z lissé) → parcours complet, au même format que parcours.json. */
export function analyserProfil(nom: string, d: number[], z: number[], source: string): Parcours {
  const segments = decrire(segmenter(d, z), d, z);
  let dplus = 0;
  let dmoins = 0;
  for (let k = 1; k < z.length; k++) {
    const diff = z[k] - z[k - 1];
    if (diff > 0) dplus += diff;
    else dmoins -= diff;
  }
  const km50: number[] = [];
  for (let s = 0; s < d[d.length - 1]; s += 50) km50.push(s);
  return {
    nom,
    distance_km: arrondi(d[d.length - 1] / 1000, 2),
    dplus_m: Math.round(dplus),
    dmoins_m: Math.round(dmoins),
    alt_max_m: Math.round(Math.max(...z)),
    alt_min_m: Math.round(Math.min(...z)),
    source_altitudes: source,
    nb_segments: segments.length,
    segments,
    profil: { d_km: km50.map((s) => arrondi(s / 1000, 3)), z_m: km50.map((s) => arrondi(interp(s, d, z), 1)) },
  };
}
