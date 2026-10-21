// Généré par scripts/index_reseaux.py : ne pas modifier à la main.
// Réseaux de zone (voies pour les boucles), chargés seulement quand un départ tombe dedans.

/* eslint-disable @typescript-eslint/no-require-imports */
export type ReseauZone = { nom: string; libelle: string; emprise: number[]; noeuds: number; fichier: number };

export const RESEAUX: ReseauZone[] = [
  { nom: "nantes", libelle: "Nantes Métropole", emprise: [47.19, -1.77, 47.25, -1.52], noeuds: 53411, fichier: require("../../assets/data/reseau/nantes.reseau") },
  { nom: "rennes", libelle: "Rennes Métropole", emprise: [47.99, -1.86, 48.21, -1.5], noeuds: 60329, fichier: require("../../assets/data/reseau/rennes.reseau") },
];
