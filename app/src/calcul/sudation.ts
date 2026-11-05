// Mes chiffres à moi : perte de sueur mesurée (test de pesée) et profil de sel, pour remplacer les
// moyennes du plan nutrition par des besoins personnels.
//
// Sources :
// - Test de pesée : ACSM, « Exercise and Fluid Replacement », position stand (Sawka et al., 2007) :
//   perte de sueur = poids avant − poids après + boisson bue − urine, sur la durée de l'effort.
//   Objectif : ne pas perdre plus de 2 % du poids du corps, et ne jamais boire plus qu'on ne sue
//   (risque d'hyponatrémie).
// - Sel : la sueur contient de 200 à plus de 2 000 mg de sodium par litre, ≈ 1 000 mg en moyenne
//   (Baker, Sports Medicine, 2017). Les boissons d'effort en apportent 300 à 900 mg/L (ISSN 2017,
//   500 à 700 mg/L recommandés) : on choisit dans cette fourchette selon le profil.

export type TestSudation = { date: string; dureeH: number; avantKg: number; apresKg: number; buL: number; temperature: number };
export type ProfilSel = "peu" | "moyen" | "sale";

/** Perte de sueur en litres par heure (1 kg perdu ≈ 1 L), ou null si le test est incohérent. */
export function tauxSudation(t: Pick<TestSudation, "dureeH" | "avantKg" | "apresKg" | "buL">): number | null {
  if (!(t.dureeH >= 0.5) || !(t.avantKg > 30) || !(t.apresKg > 30) || t.buL < 0) return null;
  const perte = (t.avantKg - t.apresKg + t.buL) / t.dureeH;
  // en dessous de 0,2 L/h ou au-delà de 3,5 L/h, c'est presque toujours une erreur de pesée
  return perte >= 0.2 && perte <= 3.5 ? Math.round(perte * 100) / 100 : null;
}

/** Part du poids perdue pendant le test (repère des 2 % de l'ACSM). */
export const partPerdue = (t: Pick<TestSudation, "avantKg" | "apresKg">) => (t.avantKg - t.apresKg) / t.avantKg;

/** Les trois questions du profil de sel : chaque « oui » compte un point. */
export const QUESTIONS_SEL = [
  "Des traces blanches sur ta casquette ou ton t-shirt après une sortie ?",
  "La sueur te pique les yeux, elle a un goût très salé ?",
  "Des crampes en fin de course longue, surtout quand il fait chaud ?",
];

export function profilSel(oui: number): ProfilSel {
  return oui >= 2 ? "sale" : oui === 1 ? "moyen" : "peu";
}

export const SEL: Record<ProfilSel, { nom: string; boissonMgL: number; detail: string }> = {
  peu: { nom: "Sueur peu salée", boissonMgL: 400, detail: "400 mg de sodium par litre bu suffisent." },
  moyen: { nom: "Sueur moyennement salée", boissonMgL: 600, detail: "600 mg de sodium par litre bu (milieu de la fourchette ISSN)." },
  sale: { nom: "Sueur très salée", boissonMgL: 900, detail: "900 mg de sodium par litre bu : pastilles de sel en plus des gels." },
};

/**
 * Test le plus proche de la température prévue (on sue bien plus au chaud), ou null.
 * À écart égal, le plus récent.
 */
export function testPourTemperature(tests: TestSudation[], temperature: number): TestSudation | null {
  const valides = tests.filter((t) => tauxSudation(t) !== null);
  if (!valides.length) return null;
  return [...valides].sort((a, b) => Math.abs(a.temperature - temperature) - Math.abs(b.temperature - temperature)
    || b.date.localeCompare(a.date))[0];
}

/**
 * Eau et sodium par heure à partir de mes chiffres : on boit environ 70 % de ce qu'on perd (de quoi
 * rester sous 2 % de perte sur une course longue sans jamais boire plus qu'on ne sue), entre 300 et
 * 1 000 ml/h (au-delà, l'estomac ne suit pas) ; le sodium suit l'eau bue selon le profil de sel.
 */
export function besoinsPersonnels(lh: number, sel: ProfilSel): { eau: number; sodium: number } {
  const eau = Math.round(Math.min(1000, Math.max(300, lh * 1000 * 0.7)) / 50) * 50;
  return { eau, sodium: Math.round((eau / 1000) * SEL[sel].boissonMgL / 50) * 50 };
}
