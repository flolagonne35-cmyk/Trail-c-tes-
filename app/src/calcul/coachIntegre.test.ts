import assert from "node:assert/strict";
import test from "node:test";

import { repondre, sujetDe, type Situation } from "./coachIntegre.ts";
import { genererPlan } from "./plan.ts";

const q = { niveau: "intermediaire" as const, seances: 4, volume_km: 35, plus_longue_km: 15, objectif: "finir" as const,
            jours: [1, 3, 5, 6], records: { "10": 45 } };
const cible = { nom: "Trail des Crêtes", distance_km: 30, dplus_m: 1200, date: "2027-04-18" };
const AUJ = new Date(2026, 10, 17); // mardi
const plan = genererPlan(cible, q, 6, AUJ);
const base: Situation = { cible, questionnaire: q, plan, semaine: plan[0], seanceDuJour: plan[0].seances.find((x) => x.type === "cotes") ?? plan[0].seances[0],
                          repos: false, allureMinKm: 6, aujourdHui: AUJ };

test("la santé passe avant tout", () => {
  assert.equal(sujetDe("J'ai une douleur dans la poitrine pendant ma séance"), "urgence");
  assert.match(repondre("j'ai eu un malaise en côte", base).texte, /15/);
  assert.equal(sujetDe("J'ai mal au genou gauche depuis ma séance"), "douleur");
  assert.match(repondre("mal au genou", base).texte, /médecin ou un kiné/);
  assert.equal(sujetDe("J'ai de la fièvre, je cours ?"), "malade");
});

test("sujets reconnus, avec ou sans accents", () => {
  assert.equal(sujetDe("Je suis crevé, j'ai mal dormi"), "fatigue");
  assert.equal(sujetDe("j'ai raté ma séance de mardi"), "manquee");
  assert.equal(sujetDe("Que manger avant ma sortie longue ?"), "nutrition");
  assert.equal(sujetDe("Mon objectif est-il réaliste ?"), "objectif");
  assert.equal(sujetDe("À quelle allure courir ?"), "allure");
  assert.equal(sujetDe("Explique-moi ma séance du jour"), "seance");
  assert.equal(sujetDe("Il va faire très chaud demain"), "meteo");
  assert.equal(sujetDe("Quel est le sens de la vie ?"), "inconnu");
});

test("réponses calculées avec le programme du coureur", () => {
  // fatigue un jour de séance dure : on la remplace, on ne la reporte pas
  assert.match(repondre("je suis fatigué", base).texte, /Remplace ta séance \(côtes/);
  // séance du jour : nom, durée, à quoi elle sert
  const s = repondre("Explique-moi ma séance du jour", base).texte;
  assert.match(s, /Aujourd'hui : côtes courtes/);
  assert.match(s, /force/);
  // allures tirées du record au 10 km
  assert.match(repondre("à quelle allure ?", base).texte, /seuil \d:\d\d/);
  // objectif : la course et les semaines restantes
  assert.match(repondre("mon objectif est-il réaliste ?", base).texte, /Trail des Crêtes|Préparation courte/);
  // nutrition : fourchette de glucides selon la durée de la séance
  assert.match(repondre("que manger ?", { ...base, seanceDuJour: { type: "longue", titre: "Sortie longue 2 h", detail: "", minutes: 120 } }).texte,
               /Pour 2 h 00 : \d+ à \d+ g de glucides par heure/);
});

test("sans programme : il le dit ; question inconnue : il renvoie vers le coach en ligne", () => {
  const vide: Situation = { cible: null, questionnaire: null, plan: null, semaine: null, seanceDuJour: null, repos: false, allureMinKm: 6 };
  assert.match(repondre("explique ma séance", vide).texte, /Mon plan/);
  assert.match(repondre("sans tes records", { ...vide }).texte.length > 0 ? repondre("à quelle allure ?", vide).texte : "", /ajoute un temps récent/);
  assert.match(repondre("quel est le sens de la vie ?", base).texte, /coach en ligne/);
});
