import assert from "node:assert/strict";
import test from "node:test";

import { heureType, panierLisible, sacCourse } from "./produits.ts";

test("70 g/h avec gels et boisson : la boisson d'abord, puis des gels, au plus près des 70 g", () => {
  const h = heureType(["gel", "boisson", "sel"], 70, 600, 500);
  assert.ok(Math.abs(h.glucides - 70) <= 10, `${h.glucides} g`);
  assert.equal(h.produits[0].produit.id, "boisson");
  assert.ok(h.sodium >= 450);
  assert.match(panierLisible(h), /boisson/);
});

test("jamais plus d'un produit caféiné par heure", () => {
  const h = heureType(["gelcafe"], 90, 0, 0);
  assert.ok(h.produits.every((x) => x.produit.id !== "gelcafe" || x.n <= 1));
});

test("sac de course : arrondi au-dessus et coût", () => {
  const h = heureType(["gel"], 50, 0, 0);
  const sac = sacCourse(h, 3.5);
  assert.equal(sac.produits[0].n, Math.ceil(h.produits[0].n * 3.5));
  assert.ok(sac.prix > 0);
});

test("rien de coché : panier vide", () => {
  assert.equal(heureType([], 60, 500, 500).produits.length, 0);
});
