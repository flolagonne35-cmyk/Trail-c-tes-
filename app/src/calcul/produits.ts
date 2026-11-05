// Mon sac à produits : traduire « 70 g de glucides et 600 mg de sodium par heure » en produits
// concrets (« 1 gel + 1 compote + 1 flasque de boisson ») et en coût de course.
//
// Valeurs indicatives de produits courants (moyennes d'étiquettes de grandes surfaces et de
// magasins de sport, 2026) : chacun vérifie l'étiquette des siens. Caféine : 3 mg/kg environ
// améliorent l'endurance (ISSN, position sur la caféine, Guest et al. 2021), à tester à
// l'entraînement ; pas plus d'un produit caféiné par heure, et plutôt en seconde moitié de course.

export type Produit = {
  id: string; nom: string; detail: string;
  glucides: number; // g
  sodium: number; // mg
  cafeine?: number; // mg
  prix: number; // € indicatifs
  boisson?: boolean; // apporte aussi de l'eau (flasque de 500 ml)
};

export const PRODUITS: Produit[] = [
  { id: "gel", nom: "Gel classique", detail: "≈ 25 g de glucides", glucides: 25, sodium: 50, prix: 1.8 },
  { id: "gel40", nom: "Gel « 2:1 » 40 g", detail: "glucose + fructose, pour viser 80 g/h et plus", glucides: 40, sodium: 100, prix: 3 },
  { id: "gelcafe", nom: "Gel à la caféine", detail: "≈ 25 g + 75 mg de caféine", glucides: 25, sodium: 50, cafeine: 75, prix: 2.2 },
  { id: "boisson", nom: "Boisson d'effort (500 ml)", detail: "≈ 30 g de glucides et 300 mg de sodium par flasque", glucides: 30, sodium: 300, prix: 1, boisson: true },
  { id: "compote", nom: "Compote à boire", detail: "gourde de 90 g, ≈ 13 g", glucides: 13, sodium: 0, prix: 0.5 },
  { id: "pate", nom: "Pâte de fruits", detail: "≈ 18 g, se mâche vite", glucides: 18, sodium: 0, prix: 0.6 },
  { id: "barre", nom: "Barre de céréales", detail: "≈ 25 g, plutôt en début de course longue", glucides: 25, sodium: 100, prix: 1.5 },
  { id: "banane", nom: "Banane", detail: "≈ 25 g, aux ravitos", glucides: 25, sodium: 0, prix: 0.25 },
  { id: "sel", nom: "Pastille de sel", detail: "≈ 250 mg de sodium", glucides: 0, sodium: 250, prix: 0.3 },
];

export type Heure = { produits: { produit: Produit; n: number }[]; glucides: number; sodium: number; cafeine: number; prix: number };

/**
 * Le mélange d'une heure de course : la boisson d'abord (selon l'eau à boire), puis la combinaison
 * de produits solides ou gels (au plus 3 de chaque par heure) la plus proche des glucides visés,
 * puis des pastilles pour compléter le sodium.
 */
export function heureType(choisis: string[], glucidesH: number, sodiumH: number, eauMlH: number): Heure {
  const dispo = PRODUITS.filter((p) => choisis.includes(p.id));
  const boisson = dispo.find((p) => p.boisson);
  const sel = dispo.find((p) => p.id === "sel");
  const autres = dispo.filter((p) => !p.boisson && p.id !== "sel").slice(0, 6);
  const panier: { produit: Produit; n: number }[] = [];
  let g = 0;
  let na = 0;
  if (boisson && glucidesH > 0) {
    // flasques par heure : l'eau à boire, en demi-flasques, sans dépasser les glucides visés
    const n = Math.min(Math.round((eauMlH / 500) * 2) / 2, Math.floor((glucidesH / boisson.glucides) * 2) / 2);
    if (n > 0) { panier.push({ produit: boisson, n }); g += n * boisson.glucides; na += n * boisson.sodium; }
  }
  // recherche exhaustive : 0 à 3 de chaque produit (au plus 4^6 combinaisons)
  let meilleur: number[] = autres.map(() => 0);
  let score = Infinity;
  const essai = (k: number, comptes: number[]) => {
    if (k === autres.length) {
      const gg = g + comptes.reduce((t, n, i) => t + n * autres[i].glucides, 0);
      const cafe = comptes.reduce((t, n, i) => t + n * (autres[i].cafeine ? 1 : 0), 0);
      if (cafe > 1) return;
      const nb = comptes.reduce((t, n) => t + n, 0);
      // écart aux glucides visés (un peu au-dessous plutôt qu'au-dessus) ; à écart égal, le moins de produits
      const ecart = gg > glucidesH ? (gg - glucidesH) * 1.2 : glucidesH - gg;
      const s = ecart + nb * 0.5;
      if (s < score) { score = s; meilleur = [...comptes]; }
      return;
    }
    for (let n = 0; n <= 3; n++) { comptes[k] = n; essai(k + 1, comptes); }
  };
  if (glucidesH - g > 5) essai(0, autres.map(() => 0));
  meilleur.forEach((n, i) => { if (n) { panier.push({ produit: autres[i], n }); g += n * autres[i].glucides; na += n * autres[i].sodium; } });
  if (sel && sodiumH - na > 150) {
    const n = Math.round((sodiumH - na) / sel.sodium);
    if (n > 0) { panier.push({ produit: sel, n }); na += n * sel.sodium; }
  }
  return { produits: panier, glucides: g, sodium: na, cafeine: panier.reduce((t, x) => t + (x.produit.cafeine ?? 0) * x.n, 0),
           prix: panier.reduce((t, x) => t + x.produit.prix * x.n, 0) };
}

/** « 1 gel classique + 2 compotes à boire » */
export const panierLisible = (h: Heure) => h.produits.map((x) => `${String(x.n).replace(".", ",")} × ${x.produit.nom.toLowerCase()}`).join(" + ");

/** Pour toute la course : chaque produit arrondi au-dessus, et le coût. */
export function sacCourse(h: Heure, heures: number) {
  const produits = h.produits.map((x) => ({ produit: x.produit, n: Math.ceil(x.n * heures) }));
  return { produits, prix: produits.reduce((t, x) => t + x.n * x.produit.prix, 0) };
}
