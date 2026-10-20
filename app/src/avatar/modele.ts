// Apparence du coureur : toutes les options de l'éditeur, valeurs par défaut, tirage au hasard.

export const PEAUX = ["#FBE0CF", "#F3CBB0", "#E7B48F", "#D29A72", "#B57A52", "#8F5B3A", "#6C4129", "#4A2C1C"];
export const CHEVEUX = ["#1E1611", "#3B2618", "#6A4123", "#9A5B2C", "#C98D45", "#E6C27A", "#A8A6A1", "#E9E6E0",
  "#B23A2B", "#2F4B8F"];
export const YEUX = ["#4A2E1A", "#7A5A2F", "#3E6E3A", "#3D6D9A", "#6B7B86"];
export const TISSUS = ["#FF5A1F", "#E8F04A", "#2BD1A0", "#1E8BF0", "#7B4DFF", "#FF3D7F", "#1A1F2B", "#FFFFFF",
  "#3A4A3F", "#C7442A", "#F2B705", "#6F7D8C"];

export type Choix<T extends string> = { valeur: T; nom: string };
const choix = <T extends string>(...l: [T, string][]): Choix<T>[] => l.map(([valeur, nom]) => ({ valeur, nom }));

export const CORPULENCES = choix(["affine", "Affûté"], ["athletique", "Athlétique"], ["moyenne", "Moyenne"],
  ["robuste", "Robuste"], ["forte", "Forte"]);
export const TAILLES = choix(["petite", "Petite"], ["moyenne", "Moyenne"], ["grande", "Grande"]);
export const FORMES_YEUX = choix(["ronds", "Ronds"], ["amande", "En amande"], ["rieurs", "Rieurs"], ["concentres", "Concentrés"]);
export const SOURCILS = choix(["fins", "Fins"], ["epais", "Épais"], ["arques", "Arqués"]);
export const BOUCHES = choix(["sourire", "Sourire"], ["dents", "Grand sourire"], ["neutre", "Concentré"], ["effort", "Dans l'effort"]);
export const BARBES = choix(["aucune", "Aucune"], ["courte", "Courte"], ["longue", "Longue"], ["moustache", "Moustache"],
  ["bouc", "Bouc"]);
export const COUPES = choix(["rasee", "Rasée"], ["courte", "Courte"], ["mi-longue", "Mi-longue"], ["longue", "Longue"],
  ["queue", "Queue haute"], ["tresse", "Tresse"], ["chignon", "Chignon"], ["boucles", "Bouclés"]);
export const HAUTS = choix(["debardeur", "Débardeur"], ["tshirt", "T-shirt"], ["manches-longues", "Manches longues"]);
export const BAS = choix(["short", "Short"], ["short-cuissard", "Short + cuissard"], ["corsaire", "Collant 3/4"],
  ["collant", "Collant long"]);
export const TETES = choix(["aucun", "Rien"], ["casquette", "Casquette"], ["bandeau", "Bandeau"], ["buff", "Tour de cou"],
  ["bonnet", "Bonnet"]);
export const SACS = choix(["aucun", "Aucun"], ["gilet", "Gilet + flasques"], ["ceinture", "Ceinture porte-bidon"]);

type V<L extends Choix<string>[]> = L[number]["valeur"];

export type Apparence = {
  silhouette: "femme" | "homme";
  corpulence: V<typeof CORPULENCES>;
  taille: V<typeof TAILLES>;
  peau: number;
  yeux: V<typeof FORMES_YEUX>;
  couleurYeux: number;
  sourcils: V<typeof SOURCILS>;
  bouche: V<typeof BOUCHES>;
  barbe: V<typeof BARBES>;
  taches: boolean; // taches de rousseur
  coupe: V<typeof COUPES>;
  cheveux: number;
  haut: V<typeof HAUTS>;
  couleurHaut: number;
  couleurBande: number;
  bas: V<typeof BAS>;
  couleurBas: number;
  chaussures: number;
  tete: V<typeof TETES>;
  couleurTete: number;
  lunettes: boolean;
  sac: V<typeof SACS>;
  couleurSac: number;
  montre: boolean;
  batons: boolean;
  dossard: string; // vide : pas de dossard
};

export const APPARENCE_DEFAUT: Apparence = {
  silhouette: "femme", corpulence: "athletique", taille: "moyenne", peau: 2, yeux: "amande", couleurYeux: 1,
  sourcils: "fins", bouche: "sourire", barbe: "aucune", taches: false, coupe: "queue", cheveux: 2,
  haut: "debardeur", couleurHaut: 0, couleurBande: 7, bas: "short-cuissard", couleurBas: 6, chaussures: 2,
  tete: "casquette", couleurTete: 7, lunettes: true, sac: "gilet", couleurSac: 6, montre: true, batons: true, dossard: "",
};

const auHasard = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

export function apparenceAleatoire(): Apparence {
  const silhouette = Math.random() < 0.5 ? "femme" : "homme";
  return {
    silhouette,
    corpulence: auHasard(CORPULENCES).valeur, taille: auHasard(TAILLES).valeur,
    peau: Math.floor(Math.random() * PEAUX.length), yeux: auHasard(FORMES_YEUX).valeur,
    couleurYeux: Math.floor(Math.random() * YEUX.length), sourcils: auHasard(SOURCILS).valeur,
    bouche: auHasard(BOUCHES).valeur,
    barbe: silhouette === "homme" && Math.random() < 0.5 ? auHasard(BARBES.slice(1)).valeur : "aucune",
    taches: Math.random() < 0.15,
    coupe: auHasard(silhouette === "femme" ? COUPES.slice(2) : COUPES.slice(0, 4)).valeur,
    cheveux: Math.floor(Math.random() * 7),
    haut: auHasard(HAUTS).valeur, couleurHaut: Math.floor(Math.random() * TISSUS.length),
    couleurBande: Math.floor(Math.random() * TISSUS.length), bas: auHasard(BAS).valeur,
    couleurBas: auHasard([6, 8, 3, 11]), chaussures: Math.floor(Math.random() * TISSUS.length),
    tete: auHasard(TETES).valeur, couleurTete: Math.floor(Math.random() * TISSUS.length),
    lunettes: Math.random() < 0.5, sac: auHasard(SACS).valeur, couleurSac: auHasard([6, 8, 4, 0, 11]),
    montre: Math.random() < 0.8, batons: Math.random() < 0.6, dossard: "",
  };
}

/** Profils enregistrés avec l'ancien avatar : on garde ce qui existe, le reste prend les valeurs par défaut. */
export function migrerApparence(a: Partial<Apparence> & Record<string, unknown>): Apparence {
  const nouvelle = { ...APPARENCE_DEFAUT, ...a } as Apparence;
  if (a.coupe === "longue" || a.coupe === "queue" || a.coupe === "chignon" || a.coupe === "courte" || a.coupe === "rasee") {
    nouvelle.coupe = a.coupe;
  }
  if (typeof a.casquette === "boolean") nouvelle.tete = a.casquette ? "casquette" : "aucun";
  if (typeof a.haut === "number") { nouvelle.couleurHaut = 0; nouvelle.haut = "debardeur"; }
  if (typeof a.bas === "number") { nouvelle.bas = "short"; }
  if (typeof a.peau === "number" && a.peau > 4) nouvelle.peau = 4;
  if (!CORPULENCES.some((c) => c.valeur === nouvelle.corpulence)) nouvelle.corpulence = "athletique";
  return nouvelle;
}
