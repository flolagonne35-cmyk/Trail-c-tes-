// Plan nutrition par tronçon entre ravitaillements. Port de scripts/plan_nutrition.py.

import type { Parcours } from "./profil.ts";
import { interp } from "./geo.ts";

export type Niveau = "debutant" | "habitue" | "entraine";

export type Preferences = {
  niveau: Niveau; // habitude de manger en courant (« intestin entraîné »)
  perso: boolean; // true : valeurs réglées à la main ; false : recommandations
  glucides: number; // g par heure
  eau: number; // ml par heure
  sodium: number; // mg par heure
  temperature: number; // °C
  partSolide: number; // 0 à 1 : part des glucides en barres
  gelG: number;
  barreG: number;
  sodiumGelMg: number;
  pastilleMg: number;
};

export const PREFERENCES_DEFAUT: Preferences = {
  niveau: "habitue", perso: false,
  glucides: 70, eau: 500, sodium: 600, temperature: 15, partSolide: 0,
  gelG: 25, barreG: 40, sodiumGelMg: 50, pastilleMg: 250,
};

export type Ravito = { km: number; nom: string };

export type Troncon = {
  n: number; de: string; a: string; km_debut: number; km_fin: number; dplus_m: number;
  duree_h: number; passage_h: number; passage: string;
  glucides_g: number; eau_ml: number; sodium_mg: number;
  gels: number; barres: number; eau_l: number; pastilles_sel: number; resume: string[];
};

/** Coût énergétique de la course (J/kg/m) selon la pente i (fraction) — Minetti et al. 2002. */
export function coutMinetti(i: number): number {
  const p = Math.min(0.45, Math.max(-0.45, i));
  return 155.4 * p ** 5 - 30.4 * p ** 4 - 43.3 * p ** 3 + 46.3 * p ** 2 + 19.5 * p + 3.6;
}

/** « 38h », « 5h40 », « 5:40 », « 340min » ou « 5.5 » → heures (NaN si illisible). */
export function lireObjectif(texte: string): number {
  const t = texte.trim().toLowerCase().replace(/\s/g, "");
  let m = t.match(/^(\d+)[h:](\d{1,2})?$/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2] ?? "0", 10) / 60;
  m = t.match(/^(\d+)min$/);
  if (m) return parseInt(m[1], 10) / 60;
  return parseFloat(t.replace(",", "."));
}

export const heuresLisibles = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Temps de course cumulé (h) à chaque point du profil, recalé sur l'objectif. */
export function tempsCumules(parcours: Parcours, objectifH: number): { d: number[]; z: number[]; t: number[] } {
  let d = parcours.profil.d_km.map((v) => v * 1000);
  let z = parcours.profil.z_m.slice();
  const total = parcours.distance_km * 1000;
  if (d[d.length - 1] < total) {
    d = [...d, total];
    z = [...z, z[z.length - 1]];
  }
  const tCumul = [0];
  for (let k = 1; k < d.length; k++) {
    const dx = Math.max(d[k] - d[k - 1], 1e-9);
    tCumul.push(tCumul[k - 1] + (dx * coutMinetti((z[k] - z[k - 1]) / dx)) / coutMinetti(0));
  }
  const echelle = objectifH / tCumul[tCumul.length - 1];
  return { d, z, t: tCumul.map((v) => v * echelle) };
}

export type Passage = { km: number; passage: string; allure: string };

/** Heure de passage et allure (min/km) de chaque tronçon de `pasKm` kilomètres. */
export function tempsDePassage(parcours: Parcours, objectifH: number, pasKm = 5): Passage[] {
  const { d, t } = tempsCumules(parcours, objectifH);
  const bornes: number[] = [];
  for (let km = pasKm; km < parcours.distance_km; km += pasKm) bornes.push(km);
  bornes.push(parcours.distance_km);
  let precedent = { km: 0, h: 0 };
  return bornes.map((km) => {
    const h = interp(km * 1000, d, t);
    const minKm = ((h - precedent.h) * 60) / Math.max(km - precedent.km, 1e-9);
    precedent = { km, h };
    const sec = Math.round(minKm * 60);
    return { km: Math.round(km * 10) / 10, passage: heuresLisibles(h), allure: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` };
  });
}

export function construirePlan(parcours: Parcours, objectifH: number, ravitos: Ravito[], prefs: Preferences): Troncon[] {
  const { d, z, t } = tempsCumules(parcours, objectifH);
  const total = parcours.distance_km * 1000;

  const chaleur = 1 + 0.1 * Math.max(0, (prefs.temperature - 15) / 5);
  const arrets: Ravito[] = [
    { km: 0, nom: "Départ" },
    ...ravitos.filter((r) => r.km > 0 && r.km < total / 1000).sort((a, b) => a.km - b.km),
    { km: total / 1000, nom: "Arrivée" },
  ];
  return arrets.slice(1).map((arr, i) => {
    const dep = arrets[i];
    const t0 = interp(dep.km * 1000, d, t);
    const t1 = interp(arr.km * 1000, d, t);
    const duree = t1 - t0;
    let dplus = 0;
    for (let k = 1; k < d.length; k++) {
      if (d[k - 1] >= dep.km * 1000 && d[k] <= arr.km * 1000) dplus += Math.max(0, z[k] - z[k - 1]);
    }
    const glucides = prefs.glucides * duree;
    const eau = prefs.eau * duree * chaleur;
    const sodium = prefs.sodium * duree * chaleur;
    const gSolide = glucides * prefs.partSolide;
    const barres = gSolide > 0 ? Math.ceil(gSolide / prefs.barreG - 0.2) : 0;
    const gels = Math.max(0, Math.ceil((glucides - barres * prefs.barreG) / prefs.gelG - 0.2));
    const eauL = Math.ceil(eau / 250) * 0.25;
    const pastilles = Math.max(0, Math.ceil((sodium - gels * prefs.sodiumGelMg) / prefs.pastilleMg - 0.2));
    const resume = [
      ...(gels ? [pluriel(gels, "gel")] : []),
      ...(barres ? [pluriel(barres, "barre")] : []),
      `${String(eauL).replace(".", ",")} L d'eau`,
      ...(pastilles ? [`${pluriel(pastilles, "pastille")} sel`] : []),
    ];
    return {
      n: i + 1, de: dep.nom, a: arr.nom, km_debut: Math.round(dep.km * 10) / 10, km_fin: Math.round(arr.km * 10) / 10,
      dplus_m: Math.round(dplus), duree_h: duree, passage_h: t1, passage: heuresLisibles(t1),
      glucides_g: Math.round(glucides), eau_ml: Math.round(eau), sodium_mg: Math.round(sodium),
      gels, barres, eau_l: eauL, pastilles_sel: pastilles, resume,
    };
  });
}

// ---------------------------------------------------------------------------- recommandations
// Sources :
// - glucides : ACSM, Academy of Nutrition and Dietetics, Dietitians of Canada, « Nutrition and
//   Athletic Performance » (Thomas et al. 2016) ; Jeukendrup 2014, « A step towards personalized
//   sports nutrition: carbohydrate intake during exercise » (Sports Med) :
//   < 45 min rien, 1 h à 2 h 30 : 30 à 60 g/h, au-delà de 2 h 30 : jusqu'à 90 g/h en mélangeant
//   glucose et fructose (gels « 2:1 ») ; au-delà de 60 g/h, l'intestin doit être entraîné.
// - eau et sodium : ISSN, « Position stand: nutritional considerations for single-stage
//   ultra-marathon training and racing » (Tiller et al. 2019) : 450 à 750 ml/h, sodium 500 à
//   700 mg par litre bu ; boire selon la soif, sans dépasser ce qu'on perd en sueur.

export const NIVEAUX: [Niveau, string, string][] = [
  ["debutant", "Débutant", "Je mange peu en courant ou j'ai déjà eu des soucis de ventre"],
  ["habitue", "Habitué", "Je prends des gels ou des barres à chaque longue sortie"],
  ["entraine", "Entraîné", "J'ai habitué mon ventre à 80-90 g/h à l'entraînement"],
];

export const SODIUM_PAR_LITRE_MG = 600; // milieu de la fourchette ISSN (500-700 mg/L)
export const EAU_REFERENCE_ML = 500; // à 15 °C ; l'appli ajoute 10 % par 5 °C au-dessus

/** Fourchette de glucides conseillée (g/h) selon la durée d'effort. */
export function fourchetteGlucides(dureeH: number): [number, number] {
  if (dureeH < 0.75) return [0, 30];
  if (dureeH <= 2.5) return [30, 60];
  return [60, 90];
}

/** Réglages conseillés pour une course de `dureeH` heures. */
export function recommandation(dureeH: number, niveau: Niveau): Pick<Preferences, "glucides" | "eau" | "sodium" | "partSolide"> {
  const [bas, haut] = fourchetteGlucides(dureeH);
  const part = niveau === "debutant" ? 0 : niveau === "habitue" ? 0.5 : 1;
  return {
    glucides: Math.round((bas + (haut - bas) * part) / 5) * 5,
    eau: EAU_REFERENCE_ML,
    sodium: Math.round((EAU_REFERENCE_ML * SODIUM_PAR_LITRE_MG) / 1000 / 50) * 50,
    // au-delà de 4 h, le solide (barres, salé) évite l'écœurement du « tout gel »
    partSolide: dureeH > 4 ? 0.3 : 0,
  };
}

/** Phrase qui explique la fourchette de glucides pour cette durée. */
export function pourquoiGlucides(dureeH: number): string {
  if (dureeH < 0.75) return "Moins de 45 min : tes réserves suffisent, manger n'est pas nécessaire.";
  if (dureeH <= 2.5) return "Entre 45 min et 2 h 30 : 30 à 60 g de glucides par heure retardent la fatigue.";
  return "Au-delà de 2 h 30, tes réserves (glycogène) ne suffisent plus : 60 à 90 g par heure, avec des gels glucose + fructose au-delà de 60 g.";
}

/** Besoins effectifs par heure, chaleur comprise (comme construirePlan). */
export function besoinsParHeure(prefs: Preferences) {
  const chaleur = 1 + 0.1 * Math.max(0, (prefs.temperature - 15) / 5);
  return { glucides: prefs.glucides, eau: Math.round(prefs.eau * chaleur), sodium: Math.round(prefs.sodium * chaleur) };
}

/** Routine d'une heure de course : « 1 gel toutes les 20 min », etc. */
export function routineHoraire(prefs: Preferences): string[] {
  const b = besoinsParHeure(prefs);
  const lignes: string[] = [];
  const gSolide = b.glucides * prefs.partSolide;
  const gGels = b.glucides - gSolide;
  if (b.glucides === 0) lignes.push("Pas besoin de manger : de l'eau suffit.");
  if (gGels > 0) {
    const parHeure = gGels / prefs.gelG;
    lignes.push(`${nombreFr(parHeure)} gel${parHeure > 1 ? "s" : ""} de ${prefs.gelG} g par heure, soit un toutes les ${Math.round(60 / parHeure)} min`);
  }
  if (gSolide > 0) lignes.push(`${nombreFr(gSolide / prefs.barreG)} barre de ${prefs.barreG} g par heure (ou l'équivalent en salé au ravito)`);
  lignes.push(`${b.eau} ml d'eau par heure : quelques gorgées toutes les 10 à 15 min, selon la soif`);
  lignes.push(`${b.sodium} mg de sodium par heure (boisson d'effort, pastilles ou salé)`);
  return lignes;
}

const nombreFr = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
