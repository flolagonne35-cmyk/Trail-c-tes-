// Courses à venir : période, type, formats, recherche, rayon et tri.

import { test } from "node:test";
import assert from "node:assert/strict";

import { coursesAVenir, FILTRES_AGENDA, formatsLisibles, type CourseAVenir } from "./agenda.ts";

const c = (id: string, date: string, lat: number, d: number[], type: "trail" | "route" = "trail", nom = `Course ${id}`): CourseAVenir => ({
  id, nom, date, fin: date, lat, lon: -1.68, commune: "Rennes", cp: "35000", distances_km: d, dplus_m: null, type,
  site: "", source: "DATAtourisme", auteur: "", maj: "",
});
const liste = [c("a", "2026-11-08", 48.12, [10, 21.1], "route", "Foulées de Rennes"), c("b", "2026-10-25", 48.30, [14, 32]),
               c("c", "2027-09-01", 48.12, [55]), c("d", "2026-10-01", 48.12, [10]), c("e", "2026-12-06", 47.2, [25])];
const ici = { lat: 48.11, lon: -1.68 };
const auj = new Date("2026-10-21T08:00:00Z");

test("courses à venir : période, rayon, type, formats, texte, tri", () => {
  const ids = (f: object) => coursesAVenir(liste, ici, { ...FILTRES_AGENDA, ...f }, auj).map((x) => x.id);
  assert.deepEqual(ids({}), ["b", "a"]); // d passée, c dans 10 mois, e à 100 km
  assert.deepEqual(ids({ rayonKm: Infinity }), ["b", "a", "e"]);
  assert.deepEqual(ids({ moisMax: 12 }), ["b", "a", "c"]);
  assert.deepEqual(ids({ type: "route" }), ["a"]);
  assert.deepEqual(ids({ kmMin: 30 }), ["b"]);
  assert.deepEqual(ids({ kmMax: 12 }), ["a"]);
  assert.deepEqual(ids({ texte: "foulees" }), ["a"]);
  assert.deepEqual(ids({ tri: "distance" }), ["a", "b"]);
  assert.deepEqual(ids({ tri: "longueur" }), ["b", "a"]);
  assert.equal(formatsLisibles([10, 21.1, 42.2]), "10, 21,1 et 42,2 km");
});

test("régions et départements : code postal, Corse, outre-mer", async () => {
  const { departementDeCp, regionDe, dansRegion } = await import("./regions.ts");
  assert.equal(departementDeCp("35000"), "35");
  assert.equal(departementDeCp("20000"), "2A");
  assert.equal(departementDeCp("20200"), "2B");
  assert.equal(departementDeCp("97400"), "974");
  assert.equal(departementDeCp(""), "");
  assert.equal(regionDe("44"), "PDL");
  assert.equal(dansRegion("BRE"), "en Bretagne");
});

test("courses rangées : dans la ville, autour, ailleurs dans la région ; par département ; par région", async () => {
  const { grouperCourses } = await import("./agenda.ts");
  const { departementDeCp } = await import("./regions.ts");
  const mk = (id: string, lat: number, lon: number, cp: string): CourseAVenir => ({ ...c(id, "2026-11-15", lat, [10]), lon, cp });
  const courses = [mk("rennes", 48.112, -1.68, "35000"), mk("bruz", 48.03, -1.75, "35170"),
                   mk("brest", 48.39, -4.49, "29200"), mk("nantes", 47.22, -1.55, "44000")];
  const depDe = (x: CourseAVenir) => departementDeCp(x.cp);
  const lieu = { position: ici, nom: "Rennes", dep: "35" };
  const f = { ...FILTRES_AGENDA, rayonKm: 30 };
  const g = (z: object) => grouperCourses(courses, z as never, lieu, f, depDe, auj).map((x) => `${x.titre}: ${x.courses.map((y) => y.id).join(",")}`);
  assert.deepEqual(g({ mode: "autour" }), ["À Rennes: rennes", "Autour de Rennes (≤ 30 km): bruz", "Ailleurs en Bretagne: brest"]);
  assert.deepEqual(g({ mode: "departement", code: "35" }), ["Ille-et-Vilaine (35): rennes,bruz", "Ailleurs en Bretagne: brest"]);
  assert.deepEqual(g({ mode: "region", code: "PDL" }), ["Loire-Atlantique (44): nantes"]);
});
