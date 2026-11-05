// « Mon aventure » (Mon monde) : un chemin de montagne qui monte avec les points, des défis de la
// semaine et du mois, des badges de rareté, et des décors à acheter avec ses points.
//
// Tout se calcule sur le téléphone à partir des sorties validées (GPX). Les classements entre
// coureurs et les objets de marque viendront avec les comptes en ligne (docs/refonte.md § 7).
// Règle : les points se gagnent en courant, jamais en payant (pas de coffres au hasard).

import type { Activite } from "./points.ts";

export type Rarete = "commun" | "rare" | "epique" | "legendaire";
export const RARETES: Record<Rarete, { nom: string; couleur: string; fond: string }> = {
  commun: { nom: "Commun", couleur: "#5A6259", fond: "#EFEADF" },
  rare: { nom: "Rare", couleur: "#2F6F9F", fond: "#DCEAF4" },
  epique: { nom: "Épique", couleur: "#7B3FA0", fond: "#EEDFF6" },
  legendaire: { nom: "Légendaire", couleur: "#B8860B", fond: "#FBF0C9" },
};

/** Paliers du chemin : du fond de vallée au sommet (points cumulés gagnés). */
export const PALIERS: { points: number; nom: string; altitude: number }[] = [
  { points: 0, nom: "Fond de vallée", altitude: 300 },
  { points: 50, nom: "Premier lacet", altitude: 600 },
  { points: 150, nom: "Source des Biches", altitude: 900 },
  { points: 300, nom: "Refuge des Marmottes", altitude: 1300 },
  { points: 600, nom: "Col du Vent", altitude: 1700 },
  { points: 1000, nom: "Lac d'Altitude", altitude: 2100 },
  { points: 1600, nom: "Refuge des Crêtes", altitude: 2500 },
  { points: 2500, nom: "Brèche du Glacier", altitude: 3000 },
  { points: 4000, nom: "Arête Finale", altitude: 3600 },
  { points: 6000, nom: "Le Sommet", altitude: 4200 },
];

/** Palier atteint, palier suivant et avancement vers lui (0 à 1). */
export function palier(points: number) {
  let i = 0;
  while (i + 1 < PALIERS.length && points >= PALIERS[i + 1].points) i++;
  const suivant = PALIERS[i + 1] ?? null;
  const avance = suivant ? (points - PALIERS[i].points) / (suivant.points - PALIERS[i].points) : 1;
  return { rang: i, actuel: PALIERS[i], suivant, avance };
}

const validees = (a: Activite[]) => a.filter((x) => x.statut === "validee");
const montees = (a: Activite[]) => a.reduce((t, x) => t + x.repetitions.reduce((s, r) => s + r.n, 0), 0);
const lundi = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export type Defi = { id: string; titre: string; valeur: number; cible: number; unite: string };

/** Défis de la semaine (depuis lundi) et du mois (depuis le 1er), avec l'avancement. */
export function defis(activites: Activite[], maintenant = new Date()) {
  const a = validees(activites);
  const semaine = a.filter((x) => new Date(x.date) >= lundi(maintenant));
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const mois = a.filter((x) => new Date(x.date) >= debutMois);
  const somme = (l: Activite[], f: (x: Activite) => number) => Math.round(l.reduce((t, x) => t + f(x), 0));
  return {
    semaine: [
      { id: "s-sorties", titre: "3 sorties dans la semaine", valeur: semaine.length, cible: 3, unite: "sorties" },
      { id: "s-dplus", titre: "300 m de D+", valeur: somme(semaine, (x) => x.dplus_m), cible: 300, unite: "m" },
      { id: "s-cotes", titre: "5 montées de côtes", valeur: montees(semaine), cible: 5, unite: "montées" },
    ] as Defi[],
    mois: [
      { id: "m-km", titre: "100 km dans le mois", valeur: somme(mois, (x) => x.distance_km), cible: 100, unite: "km" },
      { id: "m-dplus", titre: "1 500 m de D+ dans le mois", valeur: somme(mois, (x) => x.dplus_m), cible: 1500, unite: "m" },
    ] as Defi[],
  };
}

export type Badge = { id: string; nom: string; detail: string; rarete: Rarete; obtenu: boolean; avancement: number };

/** Semaines consécutives (jusqu'à cette semaine ou la précédente) avec au moins 2 sorties. */
export function serieSemaines(activites: Activite[], maintenant = new Date()): number {
  const parSemaine = new Map<number, number>();
  for (const x of validees(activites)) {
    const k = lundi(new Date(x.date)).getTime();
    parSemaine.set(k, (parSemaine.get(k) ?? 0) + 1);
  }
  let k = lundi(maintenant).getTime();
  if ((parSemaine.get(k) ?? 0) < 2) k -= 7 * 86400000; // la semaine en cours n'est pas finie
  let n = 0;
  while ((parSemaine.get(k) ?? 0) >= 2) { n++; k = lundi(new Date(k - 3 * 86400000)).getTime(); }
  return n;
}

export function badges(activites: Activite[], maintenant = new Date()): Badge[] {
  const a = validees(activites);
  const km = a.reduce((t, x) => t + x.distance_km, 0);
  const dplus = a.reduce((t, x) => t + x.dplus_m, 0);
  const plusLongue = Math.max(0, ...a.map((x) => x.distance_km));
  const plusHaute = Math.max(0, ...a.map((x) => x.dplus_m));
  const serie = serieSemaines(activites, maintenant);
  const b = (id: string, nom: string, detail: string, rarete: Rarete, valeur: number, cible: number): Badge =>
    ({ id, nom, detail, rarete, obtenu: valeur >= cible, avancement: Math.min(1, valeur / cible) });
  return [
    b("premiere", "Premiers pas", "Ajouter sa première sortie GPX", "commun", a.length, 1),
    b("cote10", "Grimpeur", "10 montées de côtes de l'appli", "commun", montees(a), 10),
    b("km100", "Cent bornes", "100 km au compteur", "commun", km, 100),
    b("d1000", "Mille mètres", "1 000 m de D+ cumulés", "rare", dplus, 1000),
    b("long20", "Sortie longue", "Une sortie de plus de 20 km", "rare", plusLongue, 20),
    b("serie4", "Régulier", "4 semaines de suite avec au moins 2 sorties", "rare", serie, 4),
    b("cote100", "Mollets d'acier", "100 montées de côtes", "epique", montees(a), 100),
    b("haute1000", "Grosse journée", "1 000 m de D+ en une sortie", "epique", plusHaute, 1000),
    b("km1000", "Mille bornes", "1 000 km au compteur", "epique", km, 1000),
    b("everest", "Everest", "8 848 m de D+ cumulés : la hauteur de l'Everest", "legendaire", dplus, 8848),
    b("ultra", "Ultra", "Une sortie de plus de 80 km", "legendaire", plusLongue, 80),
  ];
}

/** Décors du portrait du coureur, à acheter avec ses points (dépensés, mais toujours comptés au classement). */
export const DECORS: { id: string; nom: string; prix: number; rarete: Rarete; ciel: [string, string]; monts: [string, string] }[] = [
  { id: "vallee", nom: "Vallée verte", prix: 0, rarete: "commun", ciel: ["#CFE6F3", "#F4F1EA"], monts: ["#9DB89A", "#6E8F6B"] },
  { id: "foret", nom: "Forêt bretonne", prix: 150, rarete: "commun", ciel: ["#DDE8D5", "#F4F1EA"], monts: ["#4F7A52", "#2E5233"] },
  { id: "aube", nom: "Crêtes à l'aube", prix: 400, rarete: "rare", ciel: ["#F7C9A9", "#FCE9D8"], monts: ["#8C6F8F", "#5B4A66"] },
  { id: "glacier", nom: "Glacier", prix: 900, rarete: "epique", ciel: ["#BFE3F2", "#EAF6FB"], monts: ["#DDEFF7", "#8FB7CC"] },
  { id: "nuit", nom: "Nuit étoilée à la frontale", prix: 2000, rarete: "legendaire", ciel: ["#1B2A4A", "#3E4F7A"], monts: ["#2C3550", "#151B2E"] },
];

/** Points encore à dépenser : gagnés moins achats. */
export const solde = (gagnes: number, achats: string[]) =>
  gagnes - achats.reduce((t, id) => t + (DECORS.find((d) => d.id === id)?.prix ?? 0), 0);
