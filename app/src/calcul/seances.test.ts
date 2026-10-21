// Séances de répétitions et descentes.

import { test } from "node:test";
import assert from "node:assert/strict";

import { cotesProches, enDescente, type Cote } from "./cotes.ts";
import { chercherSeance, lireSeance, meilleurePortion, pointA } from "./seances.ts";

test("lecture d'une séance écrite par un coach", () => {
  assert.deepEqual(lireSeance("8 × 400 m à 10 %"), { repetitions: 8, longueurM: 400, pente: 10 });
  assert.deepEqual(lireSeance("8x400 10%"), { repetitions: 8, longueurM: 400, pente: 10 });
  assert.deepEqual(lireSeance("6 x 1 km à 6,5 %"), { repetitions: 6, longueurM: 1000, pente: 6.5 });
  assert.deepEqual(lireSeance("6 x 1"), { repetitions: 6, longueurM: 1000, pente: null });
  assert.deepEqual(lireSeance("10 × 200 m"), { repetitions: 10, longueurM: 200, pente: null });
  assert.equal(lireSeance("footing 1 h"), null);
  assert.equal(lireSeance("8 x 400 à 80 %"), null);
});

// côte de 600 m : 200 m à 4 %, puis 400 m à 10 % ; tracé plein nord depuis (48.1, −1.68)
const profilD = Array.from({ length: 61 }, (_, i) => i * 10);
const profilZ = profilD.map((d) => (d <= 200 ? d * 0.04 : 8 + (d - 200) * 0.1));
const geometrie: [number, number][] = profilD.map((d) => [-1.68, 48.1 + d / 111195]);
const base: Cote = {
  id: 1, lat: 48.1, lon: -1.68, longueur_m: 600, pente_moy_pct: 8, pente_max_pct: 10, dplus_m: 48, alt_depart_m: 0,
  alt_arrivee_m: 48, type_voie: "chemin", nom: "", revetement: "", technicite: "", trafic: "calme",
  pentes_50m: [4, 4, 4, 4, 10, 10, 10, 10, 10, 10, 10, 10], profil: { d: profilD, z: profilZ }, geometrie,
};

test("la portion de 400 m à 10 % est trouvée au bon endroit", () => {
  const p = meilleurePortion(base, 400, 10)!;
  assert.equal(p.debut, 200);
  assert.ok(Math.abs(p.pente - 10) < 0.01);
  const a = pointA(base, 200);
  assert.ok(Math.abs(a.lat - (48.1 + 200 / 111195)) < 1e-5);
});

test("descente : même côte depuis le sommet, profil inversé", () => {
  const d = enDescente(base);
  assert.equal(d.sens, "descente");
  assert.equal(d.lat, geometrie[60][1]);
  assert.equal(d.profil.d[0], 0);
  assert.equal(d.profil.z[0], 48);
  assert.deepEqual(d.pentes_50m.slice(0, 2), [10, 10]);
});

test("séance : propositions triées, pente respectée, temps estimé", () => {
  const loin: Cote = { ...base, id: 2, lat: 48.2, geometrie: geometrie.map(([lo, la]) => [lo, la + 0.1]) };
  const plate: Cote = { ...base, id: 3, profil: { d: profilD, z: profilD.map((d) => d * 0.04) } };
  const filtres = { rayonM: 5000, penteMin: 5, types: ["route", "chemin", "sentier"] as Cote["type_voie"][] };
  const r = chercherSeance([loin, plate, base], { lat: 48.1, lon: -1.68 }, { repetitions: 8, longueurM: 400, pente: 10 },
                           "montee", filtres);
  assert.deepEqual(r.map((p) => p.cote.id), [1, 2, 3]); // les deux à 10 %, la plus proche d'abord ; la plate en dernier
  assert.equal(r[0].dplusM, 40);
  assert.ok(r[0].minutesTotal > 8 * r[0].minutesEffort);
  const desc = chercherSeance([base], { lat: 48.1, lon: -1.68 }, { repetitions: 5, longueurM: 400, pente: 10 }, "descente", filtres);
  assert.equal(desc.length, 1);
  assert.ok(Math.abs(desc[0].pente - 10) < 0.01);
  assert.ok(desc[0].minutesEffort < r[0].minutesEffort); // descendre est plus rapide
});

test("filtres : longueur, D+ et routes passantes", () => {
  const passante: Cote = { ...base, id: 4, trafic: "passant" };
  const courte: Cote = { ...base, id: 5, longueur_m: 250, dplus_m: 15 };
  const f = { rayonM: 5000, penteMin: 5, types: ["route", "chemin", "sentier"] as Cote["type_voie"][] };
  const pos = { lat: 48.1, lon: -1.68 };
  assert.deepEqual(cotesProches([base, passante, courte], pos, { ...f, eviterPassant: true }).map((c) => c.id).sort(), [1, 5]);
  assert.deepEqual(cotesProches([base, passante, courte], pos, { ...f, longueur: "courtes" }).map((c) => c.id), [5]);
  assert.deepEqual(cotesProches([base, courte], pos, { ...f, dplusMin: 40 }).map((c) => c.id), [1]);
});

test("préparer une course : passages-clés et côte équivalente près de chez moi", async () => {
  const { passagesCles } = await import("./seances.ts");
  const seg = (n: number, type: "montée" | "descente" | "plat", km: number, d: number, pente: number) => ({
    n, type, km_debut: km, km_fin: km + 2, distance_km: 2, dplus_m: type === "montée" ? d : 0, dmoins_m: type === "descente" ? d : 0,
    pente_moy_pct: pente, pente_max_pct: pente, alt_debut_m: 0, alt_fin_m: 0, difficulte: "", description: "" });
  const douce: Cote = { ...base, id: 9, pente_moy_pct: 4, dplus_m: 20 };
  const r = passagesCles([seg(1, "plat", 0, 0, 0), seg(2, "montée", 2, 400, 9), seg(3, "descente", 4, 300, -5)],
                         [base, douce], { lat: 48.1, lon: -1.68 });
  assert.equal(r.length, 2);
  assert.equal(r[0].cote.id, 1); // 8 % pour une montée à 9 %
  assert.equal(r[0].repetitions, Math.ceil(400 / 48));
  assert.equal(r[1].sens, "descente");
  assert.equal(r[1].cote.id, 9); // 4 % pour une descente à 5 %
  assert.equal(r[1].cote.sens, "descente");
});

test("filtres en plages (min et max), sol, et tri des résultats", async () => {
  const { cotesProches, trierCotes, resumeFiltres, plageLisible } = await import("./cotes.ts");
  const pos = { lat: 48.1, lon: -1.68 };
  const mk = (id: number, pente: number, raide: number, L: number, dplus: number, rev: string, dLat: number): Cote => ({
    id, lat: 48.1 + dLat, lon: -1.68, longueur_m: L, pente_moy_pct: pente, pente_max_pct: raide, dplus_m: dplus,
    alt_depart_m: 50, alt_arrivee_m: 50 + dplus, type_voie: "route", nom: "", revetement: rev, technicite: "",
    pentes_50m: [], profil: { d: [], z: [] }, geometrie: [],
  });
  const cotes = [mk(1, 5, 7, 200, 10, "goudronné", 0.001), mk(2, 9, 14, 600, 54, "terre", 0.002),
                 mk(3, 12, 20, 1200, 144, "goudronné (supposé)", 0.003)];
  const f = { rayonM: 5000, penteMin: 0, types: ["route"] as Cote["type_voie"][] };
  const ids = (g: object) => cotesProches(cotes, pos, { ...f, ...g }).map((c) => c.id);
  assert.deepEqual(ids({ penteMin: 6, penteMax: 10 }), [2]);
  assert.deepEqual(ids({ raideMin: 10 }), [2, 3]);
  assert.deepEqual(ids({ longueurMin: 300, longueurMax: 1000 }), [2]);
  assert.deepEqual(ids({ dplusMax: 60 }), [1, 2]);
  assert.deepEqual(ids({ sols: ["terre"] }), [2]);
  assert.deepEqual(ids({ sols: ["goudronne"] }), [1, 3]);
  const toutes = cotesProches(cotes, pos, f);
  assert.deepEqual(trierCotes(toutes, "dplus", false).map((c) => c.id), [3, 2, 1]);
  assert.deepEqual(trierCotes(toutes, "pente", true).map((c) => c.id), [1, 2, 3]);
  assert.deepEqual(trierCotes(toutes, "distance", false).map((c) => c.id), [3, 2, 1]);
  const { meilleures } = await import("./cotes.ts");
  assert.deepEqual(meilleures(toutes, { ...f, nombre: 2 }).map((c) => c.id), [1, 2]); // les 2 plus proches
  assert.deepEqual(meilleures(toutes, { ...f, tri: "dplus", croissant: false, nombre: 1 }).map((c) => c.id), [3]);
  assert.deepEqual(meilleures(toutes, { ...f, tri: "pente" }).map((c) => c.id), [3, 2, 1]); // « Toutes », la plus raide d'abord
  assert.equal(plageLisible(4, 8.5, "%"), "4 à 8,5 %");
  assert.equal(plageLisible(0, 300, "m"), "≤ 300 m");
  assert.equal(resumeFiltres({ ...f, penteMin: 6, longueurMin: 300, dplusMax: 60, sols: ["terre"] }),
               "≤ 5 km · pente ≥ 6 % · longueur ≥ 300 m · D+ ≤ 60 m · non goudronné · route");
});
