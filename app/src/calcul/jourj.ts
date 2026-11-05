// Feuille de course du jour J : le parcours découpé en sections avec, pour chacune, le temps visé,
// l'heure de passage et un conseil de terrain ; les barrières horaires et la marge ; le matériel.
//
// Conseils de gestion (repères d'entraîneurs de trail, à adapter) :
// - au-delà de 12–15 % de pente, la marche active coûte autant ou moins que la course à même vitesse
//   (Giovanelli et al. 2016, « Energetics of vertical kilometer foot races ») ;
// - en descente, les contractions excentriques abîment les quadriceps : en début de course longue,
//   on descend « en gestion » pour garder des jambes (Millet et al., fatigue en ultra-trail) ;
// - manger sur le plat ou en montée douce, là où l'on respire le mieux.

import { interp } from "./geo.ts";
import { tempsCumules } from "./nutrition.ts";
import type { Parcours, Segment } from "./profil.ts";

export type LigneJourJ = {
  segment: Segment;
  duree_h: number; // temps de la section
  arrivee_h: number; // temps de course en fin de section
  heure: string | null; // heure de l'horloge en fin de section, si l'heure de départ est connue
  allure: string; // min/km moyen de la section
  conseil: string;
};

/** « 07:30 », « 7h30 », « 7 » → minutes depuis minuit (NaN si illisible). */
export function lireHeure(t: string): number {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?:\s*[h:]\s*(\d{2})?)?$/);
  if (!m) return NaN;
  const h = Number(m[1]);
  const mn = Number(m[2] ?? 0);
  return h < 24 && mn < 60 ? h * 60 + mn : NaN;
}

/** Heure de l'horloge (« 14 h 05 », « J+1 02 h 10 ») après `heures` de course depuis `departMin`. */
export function horloge(departMin: number, heures: number): string {
  const total = Math.round(departMin + heures * 60);
  const jour = Math.floor(total / 1440);
  const m = total % 1440;
  return `${jour ? `J+${jour} ` : ""}${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

const allureLisible = (minParKm: number) => {
  const s = Math.round(minParKm * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Conseil de terrain pour une section, selon sa pente et sa place dans la course. */
export function conseil(s: Segment, distanceTotaleKm: number): string {
  const avance = s.km_debut / distanceTotaleKm;
  const longue = distanceTotaleKm >= 40;
  if (s.type === "montée") {
    if (s.pente_moy_pct >= 12) return "Marche active, pas courts, mains sur les cuisses ou bâtons : plus économique que courir ici.";
    if (s.pente_moy_pct >= 7) return "Petits pas rapides, garde le même effort (pas la même allure) ; marche si le souffle s'emballe.";
    return "Montée douce : cours en souplesse, c'est un bon moment pour boire.";
  }
  if (s.type === "descente") {
    if (longue && avance < 0.6) return "Descends en gestion : les quadriceps doivent tenir jusqu'à la fin. Pas courts, regard 3 m devant.";
    if (s.pente_moy_pct <= -12) return "Descente raide : pas très courts, bras écartés pour l'équilibre, freine avec les cuisses sans te raidir.";
    return "Laisse rouler sans freiner : tu gagnes du temps sans effort.";
  }
  return avance > 0.75 ? "Dernière partie : relance si tu as des jambes, sinon garde une allure régulière."
    : "Sur le plat : relance à l'allure prévue et mange ici, on respire mieux.";
}

/** Lignes de la feuille : une par section du profil. */
export function feuilleJourJ(parcours: Parcours, objectifH: number, departMin?: number): LigneJourJ[] {
  const { d, t } = tempsCumules(parcours, objectifH);
  return parcours.segments.map((s) => {
    const t0 = interp(s.km_debut * 1000, d, t);
    const t1 = interp(s.km_fin * 1000, d, t);
    const km = Math.max(s.km_fin - s.km_debut, 0.01);
    return { segment: s, duree_h: t1 - t0, arrivee_h: t1, heure: departMin !== undefined && Number.isFinite(departMin) ? horloge(departMin, t1) : null,
             allure: allureLisible(((t1 - t0) * 60) / km), conseil: conseil(s, parcours.distance_km) };
  });
}

export type Barriere = { km: number; heureMin: number; nom: string }; // heure limite en minutes depuis minuit

/** Marge (minutes) à chaque barrière horaire : positive = en avance sur la limite. */
export function marges(parcours: Parcours, objectifH: number, departMin: number, barrieres: Barriere[]) {
  const { d, t } = tempsCumules(parcours, objectifH);
  return barrieres.map((b) => {
    const passage = departMin + interp(b.km * 1000, d, t) * 60;
    // une limite plus tôt que le départ est le lendemain
    const limite = b.heureMin < departMin ? b.heureMin + 1440 : b.heureMin;
    return { ...b, passageMin: passage, marge: Math.round(limite - passage) };
  });
}

/**
 * Matériel conseillé : la base, plus ce qu'imposent la durée, la nuit et la montagne. La liste du
 * règlement de la course fait foi (matériel obligatoire contrôlé au départ).
 */
export function materiel(parcours: Parcours, objectifH: number, nuit: boolean): string[] {
  const trail = parcours.dplus_m / parcours.distance_km >= 15;
  const montagne = parcours.alt_max_m >= 1200;
  return [
    "Dossard et épingles (ou porte-dossard), puce si fournie",
    "Montre chargée, GPX de la course dedans",
    "Chaussures déjà portées en sortie longue (jamais neuves)",
    ...(objectifH >= 1.5 ? ["Ravitaillement de la feuille nutrition (gels, barres, sel)"] : []),
    ...(trail ? ["Réserve d'eau (flasques ou poche) et gobelet personnel", "Téléphone chargé, numéro de l'organisation enregistré"] : []),
    ...(trail && objectifH >= 3 ? ["Couverture de survie, sifflet", "Veste imperméable avec capuche"] : []),
    ...(montagne || objectifH >= 6 ? ["Couche chaude manches longues, bonnet ou buff, gants"] : []),
    ...(nuit ? ["Frontale et piles de rechange (ou deuxième lampe)", "Vêtement ou brassard réfléchissant"] : []),
    ...(objectifH >= 8 ? ["Crème anti-frottements, pansements", "Bâtons, s'ils sont autorisés et que tu t'en sers à l'entraînement"] : []),
  ];
}
