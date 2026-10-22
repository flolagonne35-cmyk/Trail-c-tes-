// Accueil : séance du jour, petit mot de la semaine, message « Je pars courir ».

import { test } from "node:test";
import assert from "node:assert/strict";

import { joursRestants, lundiDe, messageDepart, petitMot, seanceDuJour } from "./jour.ts";
import type { Seance, Semaine } from "./plan.ts";

const s = (titre: string, type: Seance["type"] = "footing"): Seance => ({ type, titre, detail: "", minutes: 45 });
const semaine = (debut: string, seances: Seance[]): Semaine =>
  ({ n: 1, debut, phase: "Base", km_effort: 30, km: 28, dplus_m: 200, allegee: false, seances });
const mercredi = new Date(2026, 9, 21, 9, 0); // mercredi 21 octobre 2026
const plan = [semaine("2026-10-19", [s("Côtes", "cotes"), s("Longue", "longue"), s("Footing"), s("Repos", "repos")]),
              semaine("2026-10-26", [s("Course", "course")])];

test("lundi de la semaine et jours restants", () => {
  assert.equal(lundiDe(mercredi), "2026-10-19");
  assert.equal(joursRestants(mercredi), 5);
  assert.equal(joursRestants(new Date(2026, 9, 25)), 1); // dimanche
});

test("séance du jour : prochaine séance non faite de la semaine du plan", () => {
  const r = seanceDuJour(plan, 1, "Trail", "2026-11-01", mercredi);
  assert.equal(r.cas, "seance");
  if (r.cas === "seance") { assert.equal(r.seance.titre, "Longue"); assert.equal(r.rang, 2); assert.equal(r.total, 3); }
  assert.equal(seanceDuJour(plan, 3, "Trail", "2026-11-01", mercredi).cas, "semaine_faite");
  assert.equal(seanceDuJour(null, 0, "", undefined, mercredi).cas, "pas_de_plan");
  assert.equal(seanceDuJour(plan, 0, "Trail", "2026-10-21", mercredi).cas, "course");
  assert.equal(seanceDuJour(plan, 0, "Trail", "2026-10-20", mercredi).cas, "fini");
  assert.equal(seanceDuJour([semaine("2026-11-02", [s("x")])], 0, "Trail", "2026-12-01", mercredi).cas, "avant_plan");
});

test("petit mot : selon les entraînements faits et les jours qui restent", () => {
  assert.equal(petitMot(1, 3, "Coureur", mercredi), "T'es le meilleur ! Encore 2 entraînements cette semaine.");
  assert.equal(petitMot(2, 3, "Léa", mercredi), "Léa, t'es le meilleur ! Plus qu'un entraînement et ta semaine est bouclée.");
  assert.match(petitMot(3, 3, "Coureur", mercredi), /^Semaine bouclée : 3 entraînements sur 3/);
  assert.match(petitMot(0, 4, "Coureur", new Date(2026, 9, 19)), /^Nouvelle semaine, 4 entraînements/);
  assert.match(petitMot(0, 4, "Coureur", new Date(2026, 9, 24)), /^Il reste 2 jours pour 4 séances/);
});

test("message « Je pars courir » : départ, retour prévu, alerte 30 min après", () => {
  const m = messageDepart(90, { nom: "Couëron", lat: 47.2391, lon: -1.7472, gps: false }, new Date(2026, 9, 21, 17, 5));
  assert.match(m, /^Je pars courir à 17 h 05, retour prévu vers 18 h 35\./);
  assert.match(m, /Départ : Couëron https:\/\/www\.openstreetmap\.org\/\?mlat=47\.23910&mlon=-1\.74720/);
  assert.match(m, /pas de nouvelles à 19 h 05/);
});
