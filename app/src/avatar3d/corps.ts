// Le coureur en 3D : ce que l'on règle (sexe, taille en cm, poids en kg, morphologie, peau,
// cheveux, tenue, équipement), et comment ces réglages deviennent un corps.
//
// Le corps vient de MakeHuman (CC0) : un maillage de base et des « cibles » de morphologie,
// préparés par scripts/avatar_corps.py. Comme MakeHuman, on mélange les cibles avec des poids
// produits de fonctions affines par morceaux (makehuman/apps/humanmodifier.py, MacroModifier) :
// genre × musculature (min, moyenne, max) × poids (min, moyen, max), plus la taille (petit, grand).
//
// Repères pour passer des chiffres réels aux réglages de MakeHuman :
// - poids : l'indice de masse corporelle (IMC = kg / m²) ; 22 = poids moyen de MakeHuman, 16 = sa
//   valeur minimale, 35 = sa valeur maximale (MakeHuman va de 50 % à 150 % du poids moyen) ;
// - taille : 165 cm (femme) et 178 cm (homme) sont les tailles moyennes en France (Insee) ;
//   ± 25 cm vont du « petit » au « grand » de MakeHuman ; le corps est ensuite mis à l'échelle exacte.

export type Sexe = "femme" | "homme";
export type Morpho = "fine" | "athletique" | "puissante";
export type Coupe = "courts" | "attaches" | "chignon" | "longs" | "rases";
export type Barbe = "aucune" | "courte" | "fournie";
export type Haut = "tshirt" | "debardeur" | "brassiere";
export type Bas = "short" | "cuissard" | "collant";
export type Tete = "casquette" | "visiere" | "bandeau" | "rien";

export type Corps = {
  sexe: Sexe; tailleCm: number; poidsKg: number; morpho: Morpho; age: number;
  peau: number; coupe: Coupe; cheveux: number; yeux: number;
  /** barbe (absente des anciens profils : « aucune ») */
  barbe?: Barbe;
  profil: "trail" | "route";
  haut: Haut; bas: Bas; couleurHaut: number; couleurBas: number; couleurChaussures: number;
  tete: Tete; couleurTete: number; lunettes: boolean;
  /** équipement porté (objets des marques de l'univers Trail-côtes, voir calcul/monde.ts) */
  equipement: string[];
};

export const PEAUX = ["#F4D9C8", "#EAC2A4", "#D6A27F", "#B37C57", "#8C5C3D", "#5F3D28"];
export const CHEVEUX = [["#1E1A17", "Noirs"], ["#4A3122", "Bruns"], ["#7A5233", "Châtains"], ["#C9A266", "Blonds"],
                        ["#A0522D", "Roux"], ["#A3A3A0", "Gris"]] as const;
export const YEUX = [["#5B3A1E", "Marron"], ["#6E7F3A", "Verts"], ["#3E6E9E", "Bleus"], ["#2A1C12", "Noirs"]] as const;
/** Couleurs de tenue (celles des marques de l'univers Trail-côtes). */
export const TISSUS = [["#E8572A", "Orange"], ["#1F3D2E", "Forêt"], ["#2F6F9F", "Bleu"], ["#1B1F1D", "Noir"],
                       ["#F1F1EE", "Blanc"], ["#E8B92A", "Jaune"], ["#C9416E", "Framboise"], ["#7D8580", "Gris"]] as const;

export const MORPHOS: [Morpho, string, string][] = [
  ["fine", "Fine", "Silhouette légère, peu de muscle apparent : profil de coureur d'endurance"],
  ["athletique", "Athlétique", "Musclée et dessinée : profil de traileur entraîné"],
  ["puissante", "Puissante", "Carrure et cuisses marquées : profil de coureur de montagne ou de sprinteur"],
];

export const CORPS_DEFAUT: Corps = {
  sexe: "femme", tailleCm: 166, poidsKg: 57, morpho: "athletique", age: 32, peau: 1, coupe: "attaches", cheveux: 2, yeux: 0,
  profil: "trail", haut: "debardeur", bas: "short", couleurHaut: 0, couleurBas: 3, couleurChaussures: 1,
  tete: "casquette", couleurTete: 4, lunettes: false, equipement: [],
};

/** Valeurs proposées selon le sexe (moyennes françaises de coureurs). */
export const corpsPour = (sexe: Sexe, avant: Corps = CORPS_DEFAUT): Corps => (sexe === avant.sexe ? avant : {
  ...avant, sexe, tailleCm: sexe === "homme" ? 178 : 166, poidsKg: sexe === "homme" ? 70 : 57,
  coupe: sexe === "homme" ? "courts" : "attaches", haut: sexe === "homme" ? "tshirt" : "debardeur",
});

export const imc = (c: Pick<Corps, "tailleCm" | "poidsKg">) => c.poidsKg / (c.tailleCm / 100) ** 2;
const borne = (v: number) => Math.max(0, Math.min(1, v));

/** Réglages de MakeHuman (0 à 1, 0,5 = moyen) à partir des chiffres réels. */
export function reglagesMakeHuman(c: Corps): { genre: number; muscle: number; poids: number; taille: number } {
  const i = imc(c);
  const poids = i < 22 ? 0.5 - 0.5 * (22 - i) / (22 - 16) : 0.5 + 0.5 * (i - 22) / (35 - 22);
  const moyenne = c.sexe === "homme" ? 178 : 165;
  return { genre: c.sexe === "homme" ? 1 : 0, muscle: { fine: 0.3, athletique: 0.68, puissante: 0.92 }[c.morpho],
           poids: borne(poids), taille: borne(0.5 + (c.tailleCm - moyenne) / 50) };
}

/** Poids min / moyen / max d'un réglage, comme MakeHuman (affine par morceaux autour de 0,5). */
export function troisNiveaux(v: number): Record<"min" | "average" | "max", number> {
  return v < 0.5 ? { min: 1 - v / 0.5, average: v / 0.5, max: 0 } : { min: 0, average: 1 - (v - 0.5) / 0.5, max: (v - 0.5) / 0.5 };
}

/** Poids de chaque cible (dans l'ordre des noms du fichier corps.bin). */
export function poidsCibles(c: Corps, noms: string[]): number[] {
  const r = reglagesMakeHuman(c);
  const genre = { female: 1 - r.genre, male: r.genre };
  const m = troisNiveaux(r.muscle);
  const w = troisNiveaux(r.poids);
  return noms.map((nom) => {
    const u = nom.match(/^(female|male)-(min|average|max)muscle-(min|average|max)weight$/);
    if (u) return genre[u[1] as "female" | "male"] * m[u[2] as "min"] * w[u[3] as "min"];
    const h = nom.match(/^(female|male)-(min|max)height$/);
    if (h) return genre[h[1] as "female" | "male"] * (h[2] === "max" ? Math.max(0, (r.taille - 0.5) / 0.5) : Math.max(0, (0.5 - r.taille) / 0.5));
    return 0;
  });
}

export type DonneesCorps = {
  sommets: number; triangles: number; zones: string[]; nomsCibles: string[];
  positions: Float32Array; indices: Uint16Array; zoneDe: Uint8Array; cibles: { donnees: Int8Array; echelle: number }[];
  /** squelette (version 2) : os, os et poids de chaque sommet (4 par sommet, total 255), pivots */
  os: { nom: string; parent: number }[]; osDe: Uint8Array; poidsOs: Uint8Array; pivots: Float32Array; pivotsCibles: Float32Array[];
};

/** Lit le fichier corps.bin (format décrit dans scripts/avatar_corps.py). */
export function lireCorps(tampon: ArrayBuffer): DonneesCorps {
  const vue = new DataView(tampon);
  const l = vue.getUint32(0, true);
  const entete = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 4, l))) as {
    sommets: number; triangles: number; zones: string[]; cibles: { nom: string; echelle: number }[];
    os?: { nom: string; parent: string | null }[];
  };
  let o = 4 + l;
  const aligner = () => { o += (4 - (o % 4)) % 4; };
  aligner();
  const n = entete.sommets;
  const positions = new Float32Array(tampon.slice(o, o + n * 12)); o += n * 12; aligner();
  const indices = new Uint16Array(tampon.slice(o, o + entete.triangles * 6)); o += entete.triangles * 6; aligner();
  const zoneDe = new Uint8Array(tampon.slice(o, o + n)); o += n;
  const cibles = entete.cibles.map((c) => {
    aligner();
    const donnees = new Int8Array(tampon.slice(o, o + n * 3)); o += n * 3;
    return { donnees, echelle: c.echelle };
  });
  const noms = (entete.os ?? []).map((o) => o.nom);
  const os = (entete.os ?? []).map((o) => ({ nom: o.nom, parent: o.parent ? noms.indexOf(o.parent) : -1 }));
  const nb = os.length;
  aligner();
  const osDe = new Uint8Array(tampon.slice(o, o + n * 4)); o += n * 4; aligner();
  const poidsOs = new Uint8Array(tampon.slice(o, o + n * 4)); o += n * 4; aligner();
  const pivots = new Float32Array(tampon.slice(o, o + nb * 12)); o += nb * 12;
  const pivotsCibles = cibles.map(() => { const p = new Float32Array(tampon.slice(o, o + nb * 12)); o += nb * 12; return p; });
  return { sommets: n, triangles: entete.triangles, zones: entete.zones, nomsCibles: entete.cibles.map((c) => c.nom), positions, indices, zoneDe, cibles,
           os, osDe, poidsOs, pivots, pivotsCibles };
}

/** Sommets du corps réglé : base + somme pondérée des cibles. */
export function morphoser(d: DonneesCorps, poids: number[], sortie = new Float32Array(d.positions.length)): Float32Array {
  sortie.set(d.positions);
  d.cibles.forEach((c, k) => {
    const p = poids[k] * c.echelle;
    if (!p) return;
    const x = c.donnees;
    for (let i = 0; i < x.length; i++) sortie[i] += x[i] * p;
  });
  return sortie;
}

/** Pivots des os du corps réglé (même mélange que les sommets). */
export function pivotsMorphoses(d: DonneesCorps, poids: number[]): Float32Array {
  const sortie = new Float32Array(d.pivots);
  d.pivotsCibles.forEach((pc, k) => {
    if (!poids[k]) return;
    for (let i = 0; i < pc.length; i++) sortie[i] += pc[i] * poids[k];
  });
  return sortie;
}
/**
 * Couleur de chaque zone selon la tenue : la peau là où le corps est nu, le tissu là où il est
 * habillé (t-shirt jusqu'au milieu du bras, short jusqu'à mi-cuisse, cuissard jusqu'au genou,
 * collant jusqu'à la cheville), les chaussettes au-dessus de la chaussure.
 */
export function couleurZone(zone: string, c: Corps): string {
  const peau = PEAUX[c.peau] ?? PEAUX[1];
  const haut = TISSUS[c.couleurHaut]?.[0] ?? TISSUS[0][0];
  const bas = TISSUS[c.couleurBas]?.[0] ?? TISSUS[3][0];
  const gilet = c.equipement.includes("gilet-givre") || c.equipement.includes("gilet-everest");
  switch (zone) {
    case "crane": return c.coupe === "rases" ? melange(peau, CHEVEUX[c.cheveux][0], 0.45) : CHEVEUX[c.cheveux][0];
    case "torse_haut": return gilet ? (c.equipement.includes("gilet-everest") ? "#B8860B" : "#2F6F9F") : haut;
    case "torse_bas": return c.haut === "brassiere" ? peau : haut;
    case "bras_haut": return c.haut === "tshirt" ? haut : peau;
    case "hanches": case "cuisse_haut": return bas;
    case "cuisse_bas": return c.bas === "short" ? peau : bas;
    case "mollet_haut": return c.bas === "collant" ? bas : peau;
    case "mollet_bas": return c.bas === "collant" ? bas : "#E9E7E2";
    case "pied": return TISSUS[c.couleurChaussures]?.[0] ?? TISSUS[1][0];
    case "oeil_blanc": return "#F3F0EA";
    case "iris": return YEUX[c.yeux]?.[0] ?? YEUX[0][0];
    case "pupille": return "#0E0B09";
    case "barbe": return c.barbe === "fournie" ? CHEVEUX[c.cheveux][0] : c.barbe === "courte" ? melange(peau, CHEVEUX[c.cheveux][0], 0.55) : peau;
    default: return peau;
  }
}

/** Mélange de deux couleurs hexadécimales (t = part de la seconde). */
export function melange(a: string, b: string, t: number): string {
  const v = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(v(a, i) * (1 - t) + v(b, i) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** « 1,78 m · 70 kg » */
export const resumeCorps = (c: Corps) => `${(c.tailleCm / 100).toFixed(2).replace(".", ",")} m · ${Math.round(c.poidsKg)} kg`;
