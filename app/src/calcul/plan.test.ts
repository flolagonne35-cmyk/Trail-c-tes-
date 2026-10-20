import { test } from "node:test";
import assert from "node:assert/strict";

import { genererPlan, kmEffort, lireFormat, semainesJusqua, volumePointe, type Questionnaire } from "./plan.ts";

const AUJ = new Date(2026, 9, 20); // mardi 20 octobre 2026
const q: Questionnaire = { niveau: "intermediaire", seances: 4, volume_km: 30, plus_longue_km: 15, objectif: "finir" };
const templiers = { nom: "Trail test", distance_km: 80, dplus_m: 3500, date: "2027-02-14" };

test("format écrit et durée jusqu'à la course", () => {
  assert.deepEqual(lireFormat("trail 30 km 1500 m"), { distance_km: 30, dplus_m: 1500 });
  assert.deepEqual(lireFormat("80 km 3500 D+"), { distance_km: 80, dplus_m: 3500 });
  assert.deepEqual(lireFormat("semi 21,1 km"), { distance_km: 21.1, dplus_m: 0 });
  assert.equal(lireFormat("une belle course"), null);
  assert.equal(semainesJusqua("2026-10-25", AUJ), 2); // course dans 5 jours : 2 semaines au minimum
  assert.equal(semainesJusqua("2027-10-17", AUJ), 24); // course dans un an : plan de 24 semaines
  assert.equal(semainesJusqua("2027-01-17", AUJ), 13);
  assert.equal(semainesJusqua(undefined, AUJ), 12);
});

test("plan : phases dans l'ordre, progression ≤ 10 %, semaine allégée, affûtage de 40 à 60 %", () => {
  const plan = genererPlan(templiers, q, 6, AUJ);
  assert.equal(plan.length, semainesJusqua(templiers.date, AUJ));
  assert.equal(plan[0].debut, "2026-10-19"); // lundi de la semaine en cours
  const ordre = plan.map((s) => s.phase).filter((p, i, a) => a[i - 1] !== p);
  assert.deepEqual(ordre, ["Base", "Spécifique", "Affûtage", "Course"]);
  const construction = plan.filter((s) => s.phase === "Base" || s.phase === "Spécifique");
  for (let i = 1; i < construction.length; i++) {
    const a = construction[i - 1], b = construction[i];
    if (!a.allegee && !b.allegee) assert.ok(b.km_effort <= Math.ceil(a.km_effort * 1.1) + 1, `${a.km_effort} → ${b.km_effort}`);
  }
  assert.ok(construction.some((s) => s.allegee));
  const pointe = Math.max(...construction.map((s) => s.km_effort));
  assert.ok(pointe <= volumePointe(templiers, q));
  const affutage = plan.filter((s) => s.phase === "Affûtage");
  assert.equal(affutage.length, 3); // 115 km-effort : ultra, 3 semaines
  for (const s of affutage) assert.ok(s.km_effort <= pointe * 0.71 && s.km_effort >= pointe * 0.44, String(s.km_effort));
  // spécificité : la part de D+ augmente de la base au spécifique
  const part = (s: (typeof plan)[0]) => s.dplus_m / 100 / s.km_effort;
  assert.ok(part(plan.find((s) => s.phase === "Spécifique")!) > part(plan[0]));
  // séances : autant que demandé, une sortie longue, des côtes et des descentes pour un trail montagneux
  for (const s of construction) assert.equal(s.seances.length, 4);
  const types = new Set(plan.flatMap((s) => s.seances.map((x) => x.type)));
  for (const t of ["longue", "cotes", "descentes", "footing", "course"]) assert.ok(types.has(t as never), t);
  assert.equal(plan[plan.length - 1].seances.at(-1)!.type, "course");
});

test("plan : un débutant sur 10 km plat n'a ni côtes longues ni plus d'une séance dure", () => {
  const plan = genererPlan({ nom: "10 km", distance_km: 10, dplus_m: 30 }, { ...q, niveau: "debutant", seances: 3, volume_km: 12 }, 6.5, AUJ);
  for (const s of plan.filter((x) => x.phase !== "Course")) {
    assert.ok(s.seances.filter((x) => ["cotes", "seuil", "vma", "descentes"].includes(x.type)).length <= 1);
    assert.ok(!s.seances.some((x) => x.type === "descentes"));
  }
  assert.equal(plan.filter((s) => s.phase === "Affûtage").length, 1);
  assert.equal(kmEffort(10, 30), 10.3);
});

test("catalogue : recherche sans accents, par nom ou par lieu", async () => {
  const { chercherCourses } = await import("./catalogue.ts");
  assert.equal(chercherCourses("templiers")[0].nom, "Grand Trail des Templiers");
  assert.equal(chercherCourses("saintelyon")[0].nom, "SaintéLyon");
  assert.ok(chercherCourses("chamonix").length >= 4);
  assert.deepEqual(chercherCourses("marathon rennes").map((c) => c.nom), ["Marathon Vert de Rennes"]);
  assert.deepEqual(chercherCourses("x"), []);
});

test("plan : course lointaine → le plan commence 24 semaines avant ; course proche → pas de construction", () => {
  const loin = genererPlan({ ...templiers, date: "2027-10-17" }, q, 6, AUJ);
  assert.equal(loin.length, 24);
  assert.equal(loin.at(-1)!.debut, "2027-10-11"); // semaine de la course
  assert.equal(loin[0].debut, "2027-05-03");
  const proche = genererPlan({ ...templiers, date: "2026-11-01" }, q, 6, AUJ);
  assert.deepEqual(proche.map((s) => s.phase), ["Affûtage", "Course"]); // dans 12 jours : rien à construire
});
