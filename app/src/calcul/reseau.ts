// Réseau des voies praticables à pied (exporté par scripts/exporter_reseau.py) : graphe compact,
// nœud le plus proche, plus courts chemins (Dijkstra) avec pénalités (routes, trafic).

import { distanceM, type Position } from "./geo.ts";

export type ReseauBrut = {
  source: string; zone: number[]; types: string[]; trafics: string[];
  noeuds: [number, number][]; // [lon × 1e5, lat × 1e5]
  aretes: [number, number, number, number, number, number, number, number, number[]][];
  // [a, b, longueur m, D+ de a vers b, D− de a vers b, type, trafic, nom, points intermédiaires lon,lat × 1e5]
  noms: string[];
};

export type Graphe = {
  lat: Float64Array; lon: Float64Array;
  a: Int32Array; b: Int32Array; longueur: Float32Array; plus: Float32Array; moins: Float32Array;
  type: Uint8Array; trafic: Uint8Array; inter: number[][];
  debut: Int32Array; voisins: Int32Array; arete: Int32Array; // liste d'adjacence compacte
  types: string[]; trafics: string[];
};

export function construireGraphe(r: ReseauBrut): Graphe {
  const n = r.noeuds.length;
  const m = r.aretes.length;
  const g: Graphe = {
    lat: new Float64Array(n), lon: new Float64Array(n),
    a: new Int32Array(m), b: new Int32Array(m), longueur: new Float32Array(m), plus: new Float32Array(m),
    moins: new Float32Array(m), type: new Uint8Array(m), trafic: new Uint8Array(m), inter: new Array(m),
    debut: new Int32Array(n + 1), voisins: new Int32Array(2 * m), arete: new Int32Array(2 * m),
    types: r.types, trafics: r.trafics,
  };
  r.noeuds.forEach(([lo, la], i) => { g.lon[i] = lo / 1e5; g.lat[i] = la / 1e5; });
  const degre = new Int32Array(n);
  r.aretes.forEach(([a, b, L, p, mo, t, s, , inter], k) => {
    g.a[k] = a; g.b[k] = b; g.longueur[k] = L; g.plus[k] = p; g.moins[k] = mo; g.type[k] = t; g.trafic[k] = s;
    g.inter[k] = inter;
    degre[a]++; degre[b]++;
  });
  for (let i = 0; i < n; i++) g.debut[i + 1] = g.debut[i] + degre[i];
  const rempli = g.debut.slice(0, n);
  for (let k = 0; k < m; k++) {
    g.voisins[rempli[g.a[k]]] = g.b[k]; g.arete[rempli[g.a[k]]++] = k;
    g.voisins[rempli[g.b[k]]] = g.a[k]; g.arete[rempli[g.b[k]]++] = k;
  }
  return g;
}

export function noeudLePlusProche(g: Graphe, p: Position): { noeud: number; distance_m: number } {
  let meilleur = -1;
  let dMin = Infinity;
  const cos = Math.cos((p.lat * Math.PI) / 180);
  for (let i = 0; i < g.lat.length; i++) {
    const dx = (g.lon[i] - p.lon) * cos;
    const dy = g.lat[i] - p.lat;
    const d = dx * dx + dy * dy;
    if (d < dMin) { dMin = d; meilleur = i; }
  }
  return { noeud: meilleur, distance_m: meilleur < 0 ? Infinity : distanceM(p, { lat: g.lat[meilleur], lon: g.lon[meilleur] }) };
}

export type Preferences = { eviterRoutes: boolean; eviterPassant: boolean };

/** Coût d'une arête : sa longueur, alourdie selon ce que le coureur veut éviter. */
export function cout(g: Graphe, k: number, p: Preferences): number {
  const route = g.types[g.type[k]] === "route";
  const passant = g.trafics[g.trafic[k]] === "passant";
  const modere = g.trafics[g.trafic[k]] === "modéré";
  let f = 1;
  if (passant) f *= p.eviterPassant ? 6 : 1.5;
  else if (modere) f *= 1.2;
  if (route && p.eviterRoutes) f *= 4;
  return g.longueur[k] * f;
}

/** Plus courts chemins depuis `source` : coût pondéré, et longueur réelle, D+ et D− du chemin retenu. */
export function dijkstra(g: Graphe, source: number, p: Preferences, coutMax = Infinity) {
  const n = g.lat.length;
  const cumul = new Float64Array(n).fill(Infinity);
  const longueur = new Float64Array(n);
  const plus = new Float64Array(n);
  const moins = new Float64Array(n);
  const precedent = new Int32Array(n).fill(-1); // arête d'arrivée
  const tas: number[] = []; // paires [coût, nœud] à plat
  const pousser = (c: number, v: number) => {
    tas.push(c, v);
    let i = tas.length / 2 - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (tas[2 * parent] <= tas[2 * i]) break;
      [tas[2 * parent], tas[2 * i]] = [tas[2 * i], tas[2 * parent]];
      [tas[2 * parent + 1], tas[2 * i + 1]] = [tas[2 * i + 1], tas[2 * parent + 1]];
      i = parent;
    }
  };
  const extraire = (): [number, number] => {
    const haut: [number, number] = [tas[0], tas[1]];
    const dernierV = tas.pop()!;
    const dernierC = tas.pop()!;
    if (tas.length) {
      tas[0] = dernierC; tas[1] = dernierV;
      let i = 0;
      const taille = tas.length / 2;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < taille && tas[2 * l] < tas[2 * m]) m = l;
        if (r < taille && tas[2 * r] < tas[2 * m]) m = r;
        if (m === i) break;
        [tas[2 * m], tas[2 * i]] = [tas[2 * i], tas[2 * m]];
        [tas[2 * m + 1], tas[2 * i + 1]] = [tas[2 * i + 1], tas[2 * m + 1]];
        i = m;
      }
    }
    return haut;
  };
  cumul[source] = 0;
  pousser(0, source);
  while (tas.length) {
    const [c, u] = extraire();
    if (c > cumul[u] || c > coutMax) continue;
    for (let j = g.debut[u]; j < g.debut[u + 1]; j++) {
      const v = g.voisins[j];
      const k = g.arete[j];
      const nc = c + cout(g, k, p);
      if (nc < cumul[v]) {
        cumul[v] = nc;
        longueur[v] = longueur[u] + g.longueur[k];
        const versB = g.a[k] === u;
        plus[v] = plus[u] + (versB ? g.plus[k] : g.moins[k]);
        moins[v] = moins[u] + (versB ? g.moins[k] : g.plus[k]);
        precedent[v] = k;
        pousser(nc, v);
      }
    }
  }
  return { source, cumul, longueur, plus, moins, precedent };
}

export type Arbre = ReturnType<typeof dijkstra>;

/** Arêtes du chemin source → cible, dans l'ordre, avec leur sens de parcours. */
export function chemin(g: Graphe, arbre: Arbre, cible: number): { arete: number; versB: boolean }[] {
  const res: { arete: number; versB: boolean }[] = [];
  let v = cible;
  while (v !== arbre.source) {
    const k = arbre.precedent[v];
    if (k < 0) return [];
    const versB = g.b[k] === v;
    res.push({ arete: k, versB });
    v = versB ? g.a[k] : g.b[k];
  }
  return res.reverse();
}

/** Points d'une suite d'arêtes, pour la carte et le GPX. */
export function pointsDuChemin(g: Graphe, aretes: { arete: number; versB: boolean }[]): Position[] {
  const pts: Position[] = [];
  for (const { arete: k, versB } of aretes) {
    const inter: Position[] = [];
    const brut = g.inter[k];
    for (let i = 0; i < brut.length; i += 2) inter.push({ lon: brut[i] / 1e5, lat: brut[i + 1] / 1e5 });
    const a = { lat: g.lat[g.a[k]], lon: g.lon[g.a[k]] };
    const b = { lat: g.lat[g.b[k]], lon: g.lon[g.b[k]] };
    const suite = versB ? [a, ...inter, b] : [b, ...inter.reverse(), a];
    pts.push(...(pts.length ? suite.slice(1) : suite));
  }
  return pts;
}

let grapheCharge: Graphe | null = null;

/** Réseau de l'application (assets/data/reseau.json), chargé à la première boucle. */
export function grapheApp(): Graphe {
  if (!grapheCharge) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    grapheCharge = construireGraphe(require("../../assets/data/reseau.json") as ReseauBrut);
  }
  return grapheCharge;
}
