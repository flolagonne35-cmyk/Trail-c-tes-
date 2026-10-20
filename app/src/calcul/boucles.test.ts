// Boucles sur un quadrillage fictif de 11 × 11 carrefours espacés de 200 m.

import { test } from "node:test";
import assert from "node:assert/strict";

import { composerBoucles, pointsBoucle } from "./boucles.ts";
import type { Cote } from "./cotes.ts";
import { distanceM } from "./geo.ts";
import { chemin, construireGraphe, dijkstra, noeudLePlusProche, type ReseauBrut } from "./reseau.ts";

const N = 11;
const PAS = 200;
const lat0 = 48.1;
const lon0 = -1.68;
const dLat = PAS / 111195;
const dLon = PAS / (111195 * Math.cos((lat0 * Math.PI) / 180));
const id = (i: number, j: number) => i * N + j; // i : ligne (nord), j : colonne (est)
const pos = (i: number, j: number) => ({ lat: lat0 + i * dLat, lon: lon0 + j * dLon });

function reseau(): ReseauBrut {
  const noeuds: [number, number][] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = pos(i, j);
    noeuds.push([Math.round(p.lon * 1e5), Math.round(p.lat * 1e5)]);
  }
  const aretes: ReseauBrut["aretes"] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    // colonne 8 : sentier qui monte de 10 m par arête vers le nord ; ligne 0 : route passante
    if (i + 1 < N) aretes.push([id(i, j), id(i + 1, j), PAS, j === 8 ? 10 : 0, 0, j === 8 ? 2 : 0, 0, -1, []]);
    if (j + 1 < N) aretes.push([id(i, j), id(i, j + 1), PAS, 0, 0, 0, i === 0 ? 2 : 0, -1, []]);
  }
  return { source: "test", zone: [], types: ["route", "chemin", "sentier", "piste cyclable", "liaison"],
           trafics: ["calme", "modéré", "passant"], noeuds, aretes, noms: [] };
}

const g = construireGraphe(reseau());
const cote = (k: number, i: number, j: number, longueur: number, dplus: number, type: Cote["type_voie"] = "sentier"): Cote => ({
  id: k, ...pos(i, j), longueur_m: longueur, pente_moy_pct: (dplus / longueur) * 100, pente_max_pct: 6, dplus_m: dplus,
  alt_depart_m: 0, alt_arrivee_m: dplus, type_voie: type, nom: "", revetement: "", technicite: "", trafic: "calme",
  pentes_50m: [], profil: { d: [0, longueur], z: [0, dplus] },
  geometrie: [[pos(i, j).lon, pos(i, j).lat], [pos(i + longueur / PAS, j).lon, pos(i + longueur / PAS, j).lat]],
});

test("graphe : voisins, nœud le plus proche, plus court chemin et D+ orienté", () => {
  assert.equal(g.lat.length, N * N);
  assert.equal(g.debut[id(5, 5) + 1] - g.debut[id(5, 5)], 4);
  assert.equal(noeudLePlusProche(g, { lat: pos(3, 4).lat + 0.0002, lon: pos(3, 4).lon }).noeud, id(3, 4));
  const a = dijkstra(g, id(0, 8), { eviterRoutes: false, eviterPassant: false });
  assert.equal(a.longueur[id(4, 8)], 800);
  assert.equal(a.plus[id(4, 8)], 40); // vers le nord : ça monte
  const b = dijkstra(g, id(4, 8), { eviterRoutes: false, eviterPassant: false });
  assert.equal(b.plus[id(0, 8)], 0);
  assert.equal(b.moins[id(0, 8)], 40);
  assert.equal(chemin(g, a, id(4, 8)).length, 4);
});

test("éviter les routes passantes : le chemin contourne la ligne 0", () => {
  const sans = dijkstra(g, id(0, 0), { eviterRoutes: false, eviterPassant: true });
  const etapes = chemin(g, sans, id(0, 6));
  assert.ok(etapes.every(({ arete }) => g.trafic[arete] === 0), "aucune arête passante");
  assert.equal(sans.longueur[id(0, 6)], 1600); // un crochet par la ligne 1
});

test("boucle de 6 km avec 2 côtes : retour au départ, distance tenue, côtes enchaînées", () => {
  const cotes = [cote(1, 1, 8, 600, 30), cote(2, 5, 2, 400, 12), cote(3, 2, 4, 400, 8, "route")];
  const depart = pos(4, 5);
  const r = composerBoucles(g, cotes, depart, { distanceKm: 6, nbCotes: 2, dplusVise: null, eviterRoutes: false, eviterPassant: true });
  assert.ok(Array.isArray(r) && r.length > 0, String(r));
  const b = r[0];
  assert.equal(b.cotes.length, 2);
  assert.ok(Math.abs(b.distance_m - 6000) / 6000 < 0.12, String(b.distance_m));
  const pts = pointsBoucle(b);
  assert.ok(distanceM(pts[0], depart) < 1 && distanceM(pts[pts.length - 1], depart) < 1, "boucle fermée");
  assert.equal(b.etapes.filter((e) => e.type === "cote").length, 2);
  // sans route : la côte sur route est écartée
  const sansRoute = composerBoucles(g, cotes, depart, { distanceKm: 6, nbCotes: 3, dplusVise: null, eviterRoutes: true, eviterPassant: true });
  assert.ok(Array.isArray(sansRoute) && sansRoute.every((x) => x.cotes.every((c) => c.type_voie !== "route")));
});

test("D+ visé hors d'atteinte : répétitions conseillées", () => {
  const r = composerBoucles(g, [cote(1, 1, 8, 600, 30)], pos(4, 5),
                            { distanceKm: 5, nbCotes: 1, dplusVise: 200, eviterRoutes: false, eviterPassant: false });
  assert.ok(Array.isArray(r));
  const rep = r[0].repetitions!;
  assert.equal(rep.cote.id, 1);
  assert.equal(rep.n, Math.ceil((200 - r[0].dplus_m) / 30));
  assert.equal(rep.distanceEnPlus_m, rep.n * 1200);
});

test("départ hors du réseau : message clair", () => {
  const r = composerBoucles(g, [], { lat: 47, lon: -1.5 }, { distanceKm: 5, nbCotes: 1, dplusVise: null, eviterRoutes: false, eviterPassant: false });
  assert.match(String(r), /hors du réseau/);
});
