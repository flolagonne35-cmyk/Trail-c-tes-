// Mes courses de l'année : tri, prochaine course, compte à rebours, budget et totaux.

export type Statut = "envisagee" | "inscrit" | "terminee";

export type CourseInscrite = {
  id: string;
  nom: string;
  date: string; // AAAA-MM-JJ
  lieu: string;
  distance_km: number;
  dplus_m: number;
  dossard_eur: number; // prix de l'inscription
  logement_eur: number; // logement et déplacement
  lien: string; // page d'inscription
  statut: Statut;
  objectif: string; // ex. « 5h40 »
  temps: string; // temps réalisé, une fois la course faite
};

export const NOMS_STATUT: Record<Statut, string> = { envisagee: "Envisagée", inscrit: "Inscrit", terminee: "Terminée" };

/** Jours entiers entre aujourd'hui et la date (négatif si passée). */
export function joursAvant(date: string, aujourdHui = new Date()): number {
  const j = Date.UTC(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  const [a, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - j) / 86400000);
}

export const dateValide = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function trier(courses: CourseInscrite[]): CourseInscrite[] {
  return [...courses].sort((a, b) => a.date.localeCompare(b.date));
}

/** Prochaine course à venir (aujourd'hui compris), hors courses seulement envisagées si une inscription existe. */
export function prochaine(courses: CourseInscrite[], aujourdHui = new Date()): CourseInscrite | null {
  const avenir = trier(courses).filter((c) => joursAvant(c.date, aujourdHui) >= 0 && c.statut !== "terminee");
  return avenir.find((c) => c.statut === "inscrit") ?? avenir[0] ?? null;
}

/** Totaux d'une année : nombre, km, D+, budget (dossards + logement), hors courses seulement envisagées. */
export function bilanAnnee(courses: CourseInscrite[], annee: number) {
  const retenues = courses.filter((c) => c.date.startsWith(String(annee)) && c.statut !== "envisagee");
  return {
    nombre: retenues.length,
    km: retenues.reduce((s, c) => s + c.distance_km, 0),
    dplus: retenues.reduce((s, c) => s + c.dplus_m, 0),
    budget: retenues.reduce((s, c) => s + c.dossard_eur + c.logement_eur, 0),
  };
}

/** Semaines de préparation conseillées selon la distance-effort (km + D+/100) : repère, pas une règle. */
export function semainesPrepa(c: Pick<CourseInscrite, "distance_km" | "dplus_m">): number {
  const effort = c.distance_km + c.dplus_m / 100;
  return effort < 25 ? 6 : effort < 60 ? 10 : effort < 120 ? 16 : 24;
}

/** Groupes par mois (« octobre 2026 »), dans l'ordre. */
export function parMois(courses: CourseInscrite[]): [string, CourseInscrite[]][] {
  const groupes = new Map<string, CourseInscrite[]>();
  for (const c of trier(courses)) {
    const [a, m] = c.date.split("-").map(Number);
    const cle = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
    groupes.set(cle, [...(groupes.get(cle) ?? []), c]);
  }
  return [...groupes.entries()];
}
