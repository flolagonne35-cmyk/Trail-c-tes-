import { test } from "node:test";
import assert from "node:assert/strict";

import { bilanAnnee, joursAvant, parMois, prochaine, semainesPrepa, type CourseInscrite } from "./calendrier.ts";

const c = (id: string, date: string, statut: CourseInscrite["statut"], km = 20, dplus = 500, dossard = 30, logement = 0): CourseInscrite =>
  ({ id, nom: id, date, lieu: "", distance_km: km, dplus_m: dplus, dossard_eur: dossard, logement_eur: logement, lien: "",
     statut, objectif: "", temps: "" });
const AUJ = new Date(2026, 9, 20); // 20 octobre 2026

test("compte à rebours et prochaine course", () => {
  assert.equal(joursAvant("2026-10-20", AUJ), 0);
  assert.equal(joursAvant("2026-11-01", AUJ), 12);
  assert.equal(joursAvant("2026-10-01", AUJ), -19);
  const liste = [c("passée", "2026-09-01", "terminee"), c("envie", "2026-11-01", "envisagee"), c("inscrit", "2026-12-06", "inscrit")];
  assert.equal(prochaine(liste, AUJ)!.id, "inscrit"); // une inscription passe avant une simple envie
  assert.equal(prochaine([c("envie", "2026-11-01", "envisagee")], AUJ)!.id, "envie");
  assert.equal(prochaine([c("passée", "2026-09-01", "terminee")], AUJ), null);
});

test("bilan de l'année et regroupement par mois", () => {
  const liste = [c("a", "2026-03-01", "terminee", 21, 300, 25, 0), c("b", "2026-08-29", "inscrit", 55, 3500, 180, 250),
                 c("c", "2026-11-01", "envisagee"), c("d", "2027-01-10", "inscrit")];
  assert.deepEqual(bilanAnnee(liste, 2026), { nombre: 2, km: 76, dplus: 3800, budget: 455 });
  assert.deepEqual(parMois(liste).map(([m]) => m), ["mars 2026", "août 2026", "novembre 2026", "janvier 2027"]);
  assert.equal(semainesPrepa({ distance_km: 55, dplus_m: 3500 }), 16); // 90 km-effort
  assert.equal(semainesPrepa({ distance_km: 10, dplus_m: 100 }), 6);
});
