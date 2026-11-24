// Vêtements en relief (retour du 24/11 : « le short, le tee-shirt… c'est très mal fait, dépasse-toi ») :
// chaque pièce est une « peau » posée sur le corps, décalée de quelques millimètres le long des normales,
// avec un ourlet plus foncé à ses bords, des panneaux latéraux d'une seconde couleur (comme les maillots
// techniques) et un petit logo sur la poitrine. Les pièces suivent la pose de course comme le corps.

import { melange, TISSUS, type Corps } from "./corps.ts";

export type Vetement = {
  nom: string;
  zones: string[];
  /** décalage le long des normales, en décimètres (0,05 = 5 mm) */
  epaisseur: number;
  base: string; accent: string; ourlet: string;
  rugosite: number;
  /** panneaux latéraux en couleur d'accent (maillot, short) */
  panneaux: boolean;
  /** dos ouvert devant (gilet) */
  ouvertDevant?: boolean;
  logo?: boolean;
};

const fonce = (c: string, t = 0.35) => melange(c, "#000000", t);
const clair = (c: string, t = 0.35) => melange(c, "#FFFFFF", t);
/** Couleur d'accent : orange sur un tissu sombre, une nuance plus soutenue sur un tissu clair. */
export function accentDe(base: string, choisi?: number): string {
  if (choisi !== undefined && TISSUS[choisi]) return TISSUS[choisi][0];
  const v = parseInt(base.slice(1, 3), 16) + parseInt(base.slice(3, 5), 16) + parseInt(base.slice(5, 7), 16);
  return v < 200 ? "#E8572A" : v > 600 ? "#1F3D2E" : fonce(base, 0.45);
}

export function vetementsDe(c: Corps): Vetement[] {
  const haut = TISSUS[c.couleurHaut]?.[0] ?? TISSUS[0][0];
  const bas = TISSUS[c.couleurBas]?.[0] ?? TISSUS[3][0];
  const res: Vetement[] = [];
  const zonesHaut = c.haut === "tshirt" ? ["torse_haut", "torse_bas", "bras_haut"] : c.haut === "debardeur" ? ["torse_haut", "torse_bas"] : ["torse_haut"];
  res.push({ nom: "haut", zones: zonesHaut, epaisseur: 0.045, base: haut, accent: accentDe(haut, c.couleurDetail), ourlet: fonce(haut, 0.3),
             rugosite: 0.85, panneaux: c.haut !== "brassiere", logo: c.haut !== "brassiere" });
  const zonesBas = c.bas === "short" ? ["hanches", "cuisse_haut"] : c.bas === "cuissard" ? ["hanches", "cuisse_haut", "cuisse_bas"]
    : ["hanches", "cuisse_haut", "cuisse_bas", "mollet_haut", "mollet_bas"];
  // short de course : un peu plus ample (8 mm) ; cuissard et collant : près du corps (4 mm), plus brillants
  res.push({ nom: "bas", zones: zonesBas, epaisseur: c.bas === "short" ? 0.08 : 0.04, base: bas, accent: accentDe(bas, c.couleurDetail),
             ourlet: c.bas === "short" ? clair(bas, 0.25) : fonce(bas, 0.3), rugosite: c.bas === "short" ? 0.7 : 0.45, panneaux: true });
  if (c.equipement.includes("gilet-givre") || c.equipement.includes("gilet-everest")) {
    const g = c.equipement.includes("gilet-everest") ? "#B8860B" : "#2F6F9F";
    res.push({ nom: "gilet", zones: ["torse_haut", "torse_bas"], epaisseur: 0.16, base: g, accent: "#14231B", ourlet: fonce(g, 0.4),
               rugosite: 0.6, panneaux: false, ouvertDevant: true });
  }
  return res;
}
