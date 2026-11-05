import assert from "node:assert/strict";
import test from "node:test";

import { badges, defis, palier, serieSemaines, solde } from "./monde.ts";
import type { Activite } from "./points.ts";

const sortie = (date: string, km: number, dplus: number, montees = 0): Activite => ({
  id: date + km, date: `${date}T10:00:00Z`, source: "gpx", statut: "validee", nom: "", distance_km: km, dplus_m: dplus,
  duree_min: 60, points: 0, empreinte: date + km,
  repetitions: montees ? [{ cote_id: 1, nom: "", longueur_m: 300, pente_moy_pct: 8, n: montees }] : [],
});

test("paliers : avancement vers le suivant, sommet au bout", () => {
  assert.equal(palier(0).actuel.nom, "Fond de vallée");
  const p = palier(100);
  assert.equal(p.actuel.nom, "Premier lacet");
  assert.equal(p.avance, 0.5);
  assert.equal(palier(99999).suivant, null);
});

test("défis de la semaine et du mois", () => {
  const maintenant = new Date(2026, 10, 5, 18); // jeudi
  const a = [sortie("2026-11-03", 10, 150, 3), sortie("2026-11-04", 8, 200, 2), sortie("2026-10-30", 30, 800)];
  const d = defis(a, maintenant);
  assert.equal(d.semaine[0].valeur, 2);
  assert.equal(d.semaine[1].valeur, 350);
  assert.equal(d.semaine[2].valeur, 5);
  assert.equal(d.mois[0].valeur, 18); // la sortie d'octobre ne compte pas
});

test("badges et série de semaines", () => {
  const maintenant = new Date(2026, 10, 5, 18);
  const a = ["2026-10-13", "2026-10-15", "2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29", "2026-11-03", "2026-11-04"]
    .map((d) => sortie(d, 12, 150));
  assert.equal(serieSemaines(a, maintenant), 4);
  const b = badges(a, maintenant);
  assert.ok(b.find((x) => x.id === "serie4")!.obtenu);
  assert.ok(b.find((x) => x.id === "d1000")!.obtenu); // 8 × 150 m
  assert.ok(!b.find((x) => x.id === "everest")!.obtenu);
  assert.ok(b.find((x) => x.id === "everest")!.avancement > 0.1);
});

test("solde : les achats se déduisent", () => {
  assert.equal(solde(500, ["foret"]), 350);
  assert.equal(solde(500, []), 500);
});
