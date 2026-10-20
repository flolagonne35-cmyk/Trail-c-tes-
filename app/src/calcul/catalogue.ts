// Catalogue de courses de référence, pour trouver une course par son nom.
//
// Distances et dénivelés INDICATIFS (ils changent d'une édition à l'autre) : l'appli renvoie
// toujours au site officiel pour les dates et les inscriptions. Aucune base ouverte ne recense les
// courses du monde avec leurs inscriptions (ITRA et UTMB publient la leur sans licence de
// réutilisation) : un calendrier complet passera par un partenariat ou par les organisateurs.

import { normaliser } from "./communes.ts";

export type CourseCatalogue = {
  nom: string;
  lieu: string;
  pays: string;
  mois: string; // mois habituel
  distance_km: number;
  dplus_m: number;
  type: "trail" | "route";
  site: string;
};

export const CATALOGUE: CourseCatalogue[] = [
  // trail — France
  { nom: "UTMB", lieu: "Chamonix", pays: "France", mois: "août", distance_km: 175, dplus_m: 10000, type: "trail", site: "https://montblanc.utmb.world" },
  { nom: "CCC", lieu: "Courmayeur → Chamonix", pays: "France", mois: "août", distance_km: 100, dplus_m: 6100, type: "trail", site: "https://montblanc.utmb.world" },
  { nom: "OCC", lieu: "Orsières → Chamonix", pays: "France", mois: "août", distance_km: 57, dplus_m: 3500, type: "trail", site: "https://montblanc.utmb.world" },
  { nom: "TDS", lieu: "Courmayeur → Chamonix", pays: "France", mois: "août", distance_km: 145, dplus_m: 9100, type: "trail", site: "https://montblanc.utmb.world" },
  { nom: "Grand Trail des Templiers", lieu: "Millau", pays: "France", mois: "octobre", distance_km: 80, dplus_m: 3500, type: "trail", site: "https://www.festivaldestempliers.com" },
  { nom: "SaintéLyon", lieu: "Saint-Étienne → Lyon", pays: "France", mois: "décembre", distance_km: 78, dplus_m: 2100, type: "trail", site: "https://www.saintelyon.com" },
  { nom: "Diagonale des Fous (Grand Raid)", lieu: "La Réunion", pays: "France", mois: "octobre", distance_km: 165, dplus_m: 9600, type: "trail", site: "https://www.grandraid-reunion.com" },
  { nom: "Marathon du Mont-Blanc", lieu: "Chamonix", pays: "France", mois: "juin", distance_km: 42, dplus_m: 2500, type: "trail", site: "https://www.marathonmontblanc.fr" },
  // trail — monde
  { nom: "Zegama-Aizkorri", lieu: "Zegama", pays: "Espagne", mois: "mai", distance_km: 42, dplus_m: 2700, type: "trail", site: "https://www.zegama-aizkorri.eus" },
  { nom: "Sierre-Zinal", lieu: "Sierre → Zinal", pays: "Suisse", mois: "août", distance_km: 31, dplus_m: 2200, type: "trail", site: "https://www.sierre-zinal.com" },
  { nom: "Lavaredo Ultra Trail", lieu: "Cortina d'Ampezzo", pays: "Italie", mois: "juin", distance_km: 120, dplus_m: 5800, type: "trail", site: "https://lavaredo.utmb.world" },
  { nom: "Western States 100", lieu: "Olympic Valley → Auburn", pays: "États-Unis", mois: "juin", distance_km: 161, dplus_m: 5500, type: "trail", site: "https://www.wser.org" },
  { nom: "Hardrock 100", lieu: "Silverton", pays: "États-Unis", mois: "juillet", distance_km: 161, dplus_m: 10000, type: "trail", site: "https://www.hardrock100.com" },
  // route
  { nom: "Marathon de Paris", lieu: "Paris", pays: "France", mois: "avril", distance_km: 42.195, dplus_m: 100, type: "route", site: "https://www.schneiderelectricparismarathon.com" },
  { nom: "Semi-marathon de Paris", lieu: "Paris", pays: "France", mois: "mars", distance_km: 21.1, dplus_m: 60, type: "route", site: "https://www.harmoniemutuellesemideparis.com" },
  { nom: "Marathon Vert de Rennes", lieu: "Rennes", pays: "France", mois: "octobre", distance_km: 42.195, dplus_m: 150, type: "route", site: "https://www.marathonvertrennes.com" },
  { nom: "Marathon de Nantes", lieu: "Nantes", pays: "France", mois: "avril", distance_km: 42.195, dplus_m: 100, type: "route", site: "https://www.marathondenantes.com" },
  { nom: "Marathon de Berlin", lieu: "Berlin", pays: "Allemagne", mois: "septembre", distance_km: 42.195, dplus_m: 70, type: "route", site: "https://www.bmw-berlin-marathon.com" },
  { nom: "Marathon de Londres", lieu: "Londres", pays: "Royaume-Uni", mois: "avril", distance_km: 42.195, dplus_m: 100, type: "route", site: "https://www.tcslondonmarathon.com" },
  { nom: "Marathon de New York", lieu: "New York", pays: "États-Unis", mois: "novembre", distance_km: 42.195, dplus_m: 250, type: "route", site: "https://www.nyrr.org" },
  { nom: "Marathon de Boston", lieu: "Boston", pays: "États-Unis", mois: "avril", distance_km: 42.195, dplus_m: 250, type: "route", site: "https://www.baa.org" },
];

/** Courses dont le nom ou le lieu contient tous les mots tapés (sans accents), les plus proches d'abord. */
export function chercherCourses(texte: string, liste: CourseCatalogue[] = CATALOGUE, limite = 6): CourseCatalogue[] {
  const mots = normaliser(texte).split(" ").filter((m) => m.length >= 2);
  if (!mots.length) return [];
  return liste
    .map((c) => {
      const nom = normaliser(c.nom);
      const tout = `${nom} ${normaliser(c.lieu)} ${normaliser(c.pays)}`;
      if (!mots.every((m) => tout.includes(m))) return null;
      return { c, rang: nom.startsWith(mots[0]) ? 0 : nom.includes(mots[0]) ? 1 : 2 };
    })
    .filter((x): x is { c: CourseCatalogue; rang: number } => x !== null)
    .sort((a, b) => a.rang - b.rang)
    .slice(0, limite)
    .map((x) => x.c);
}
