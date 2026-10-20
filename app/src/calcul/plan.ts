// Plan d'entraînement personnalisé pour une course : semaine par semaine, de la reprise au jour J.
//
// Repères (à adapter avec un coach ; ce n'est pas un avis médical) :
// - charge mesurée en km-effort (km + D+ / 100, la mesure de l'ITRA) ;
// - progression de 10 % par semaine au plus, et une semaine allégée (− 30 %) toutes les 4 :
//   les hausses brutales de volume (> 30 % en deux semaines) augmentent le risque de blessure chez
//   les coureurs peu entraînés (Nielsen et al. 2014, JOSPT) ;
// - environ 80 % du temps en endurance facile, 20 % en séances dures (Seiler 2010) ;
// - affûtage : volume réduit de 40 à 60 % sur 1 à 3 semaines, intensité et fréquence gardées
//   (Bosquet et al. 2007 ; Wang et al. 2023, méta-analyses) ;
// - spécificité : la part de dénivelé de l'entraînement rejoint peu à peu celle de la course.

export type Niveau = "debutant" | "intermediaire" | "confirme";
export type ObjectifCourse = "finir" | "performance";

export type CourseCible = { nom: string; distance_km: number; dplus_m: number; date?: string; site?: string };

export type Questionnaire = {
  niveau: Niveau;
  seances: number; // séances par semaine (3 à 6)
  volume_km: number; // km par semaine en ce moment
  plus_longue_km: number; // plus longue sortie des 4 dernières semaines
  objectif: ObjectifCourse;
};

export type Phase = "Base" | "Spécifique" | "Affûtage" | "Course";

export type Seance = {
  type: "longue" | "cotes" | "descentes" | "seuil" | "vma" | "footing" | "repos" | "course";
  titre: string;
  detail: string;
  minutes: number;
  /** séance à chercher autour de soi (S'entraîner → Séance) */
  seance?: string;
  /** sortie à composer (S'entraîner → Sortie) */
  sortie?: { km: number; relief: "plat" | "vallonne" | "cotes" };
};

export type Semaine = {
  n: number;
  debut: string; // AAAA-MM-JJ (lundi)
  phase: Phase;
  km_effort: number;
  km: number;
  dplus_m: number;
  allegee: boolean;
  seances: Seance[];
};

export const NIVEAUX: [Niveau, string, string][] = [
  ["debutant", "Débutant", "Moins d'un an de course régulière, pas encore de course de ce format"],
  ["intermediaire", "Intermédiaire", "Plusieurs courses finies, je cours toute l'année"],
  ["confirme", "Confirmé", "Je m'entraîne avec des séances structurées et je vise un chrono ou un classement"],
];

export const kmEffort = (km: number, dplus: number) => km + dplus / 100;

/** Volume hebdomadaire de pointe (km-effort) conseillé pour une course et un niveau. */
export function volumePointe(course: CourseCible, q: Questionnaire): number {
  const e = kmEffort(course.distance_km, course.dplus_m);
  // plus la course est longue, plus la semaine de pointe est courte par rapport à elle
  const f = e <= 25 ? 2.2 : e <= 50 ? 1.6 : e <= 100 ? 1.05 : 0.75;
  const parNiveau = { debutant: 0.8, intermediaire: 1, confirme: 1.2 }[q.niveau] * (q.objectif === "performance" ? 1.1 : 1);
  return Math.round(Math.min(160, Math.max(20, e * f * parNiveau)));
}

/** Semaines d'affûtage selon l'effort de la course. */
export function semainesAffutage(course: CourseCible): number {
  const e = kmEffort(course.distance_km, course.dplus_m);
  return e <= 25 ? 1 : e <= 100 ? 2 : 3;
}

const lundi = (d: Date) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Semaines entre aujourd'hui et la course, semaine de course comprise (non borné). */
export function semainesAvant(date: string | undefined, aujourdHui = new Date()): number {
  if (!date) return 12;
  const [a, m, j] = date.split("-").map(Number);
  return Math.round((lundi(new Date(a, m - 1, j)).getTime() - lundi(aujourdHui).getTime()) / (7 * 86400000)) + 1;
}

/** Durée du plan : 2 à 24 semaines (au-delà, le plan commence 24 semaines avant la course). */
export const semainesJusqua = (date: string | undefined, aujourdHui = new Date()) =>
  Math.max(2, Math.min(24, semainesAvant(date, aujourdHui)));

export function genererPlan(course: CourseCible, q: Questionnaire, allureMinKm = 6, aujourdHui = new Date()): Semaine[] {
  const n = semainesJusqua(course.date, aujourdHui);
  // moins de 4 semaines : trop tard pour construire, on arrive frais (affûtage seulement)
  const affutage = n < 4 ? n - 1 : Math.min(semainesAffutage(course), n - 2);
  const construction = n - affutage - 1; // la dernière semaine est celle de la course
  const ratioDplus = course.dplus_m / 100 / kmEffort(course.distance_km, course.dplus_m); // part du D+ dans l'effort
  const pointe = volumePointe(course, q);
  const depart = Math.max(10, Math.min(q.volume_km * (1 + ratioDplus), pointe));

  // volume de chaque semaine de construction : +10 % au plus, une semaine allégée sur 4, plafonné à la pointe
  const volumes: { v: number; allegee: boolean }[] = [];
  let v = depart;
  for (let i = 0; i < construction; i++) {
    const allegee = (i + 1) % 4 === 0 && i < construction - 1;
    if (allegee) volumes.push({ v: Math.round(v * 0.7), allegee });
    else {
      volumes.push({ v: Math.round(v), allegee });
      v = Math.min(pointe, v * 1.1);
    }
  }
  const fin = volumes.length ? Math.max(...volumes.map((x) => x.v)) : depart;
  const base = Math.ceil(construction * 0.45);
  const semaines: Semaine[] = [];
  // le plan finit la semaine de la course : il commence plus tard si la course est loin
  const debut = new Date(lundi(aujourdHui).getTime() + Math.max(0, semainesAvant(course.date, aujourdHui) - n) * 7 * 86400000);
  const ajouter = (phase: Phase, ke: number, allegee: boolean, i: number) => {
    // le D+ rejoint peu à peu celui de la course : 40 % de sa part au début, 100 % en fin de construction
    const progres = Math.min(1, i / Math.max(1, construction - 1));
    const part = ratioDplus * (0.4 + 0.6 * progres);
    const lundiSemaine = new Date(debut.getTime() + i * 7 * 86400000);
    const seances = seancesSemaine(phase, ke, ke * part * 100, course, q, allureMinKm, allegee);
    // volume réel de la semaine : la somme des séances (les footings sont plafonnés)
    const keReel = seances.filter((x) => x.type !== "course").reduce((t, x) => t + x.minutes, 0) / allureMinKm;
    const dplus = Math.round(keReel * part * 100);
    semaines.push({ n: i + 1, debut: iso(lundiSemaine), phase, km_effort: Math.round(keReel), km: Math.round(keReel - dplus / 100),
                    dplus_m: dplus, allegee, seances });
  };
  volumes.forEach((x, i) => ajouter(i < base ? "Base" : "Spécifique", x.v, x.allegee, i));
  for (let k = 0; k < affutage; k++) {
    // affûtage progressif : de − 30 % à − 55 % du volume de pointe
    const reduction = affutage === 1 ? 0.5 : 0.3 + (0.25 * k) / (affutage - 1);
    ajouter("Affûtage", fin * (1 - reduction), false, construction + k);
  }
  ajouter("Course", fin * 0.35, false, n - 1);
  return semaines;
}

const minutesDe = (kmE: number, allure: number) => Math.round((kmE * allure) / 5) * 5;

function seancesSemaine(phase: Phase, ke: number, dplus: number, course: CourseCible, q: Questionnaire,
                        allure: number, allegee: boolean): Seance[] {
  const eCourse = kmEffort(course.distance_km, course.dplus_m);
  const raide = course.dplus_m / Math.max(course.distance_km, 1) >= 25; // ≥ 25 m de D+ par km : course montagneuse
  const res: Seance[] = [];
  if (phase === "Course") {
    res.push({ type: "footing", titre: "Footing avec quelques accélérations", detail: "30 min facile + 4 × 20 s vite, 2 à 3 jours avant",
               minutes: 35 });
    res.push({ type: "course", titre: `Jour J : ${course.nom}`, detail: `${course.distance_km} km, ${course.dplus_m} m D+ : pars prudemment, mange et bois dès la première heure`,
               minutes: Math.round(eCourse * allure) });
    return res;
  }
  // sortie longue : ~ 30 % du volume, plafonnée selon la course (pas plus de 3 h 30 sauf ultra, 5 h)
  const plafondLongue = eCourse > 60 ? 300 : eCourse > 30 ? 210 : Math.max(70, eCourse * allure * 1.1);
  // en ultra, la sortie longue pèse plus lourd (habituer le corps aux longues heures)
  const longueKe = ke * (phase === "Affûtage" ? 0.25 : phase === "Spécifique" && eCourse > 60 ? 0.4 : 0.32);
  const longueMin = Math.min(plafondLongue, minutesDe(longueKe, allure));
  res.push({ type: "longue", titre: `Sortie longue ${heures(longueMin)}`,
             detail: phase === "Spécifique" && course.dplus_m > 300
               ? `Sur un terrain proche de la course : ≈ ${Math.round((longueMin / allure))} km, ≈ ${Math.round(dplus * 0.45)} m D+ ; teste ta nutrition`
               : `Allure facile, en aisance respiratoire${phase === "Affûtage" ? " ; raccourcie pour arriver frais" : ""}`,
             minutes: longueMin,
             sortie: { km: Math.max(5, Math.round(longueMin / allure)), relief: course.dplus_m > 300 && phase !== "Base" ? "cotes" : course.dplus_m > 300 ? "vallonne" : "plat" } });
  // séances dures : 1 en base et en semaine allégée, 2 en spécifique si au moins 4 séances
  const dures = allegee || phase === "Base" || q.seances < 4 || q.niveau === "debutant" ? 1 : 2;
  const qualite: Seance[] = [];
  if (phase === "Base") {
    qualite.push(course.dplus_m > 150
      ? { type: "cotes", titre: "Côtes courtes (force)", detail: "Échauffement 20 min, puis montées toniques, retour en trottinant", minutes: 60, seance: q.niveau === "debutant" ? "6 × 150 m à 8 %" : "10 × 200 m à 8 %" }
      : { type: "vma", titre: "Fractionné court", detail: "Échauffement 20 min, 10 × 30 s vite / 30 s lent, 10 min retour au calme", minutes: 50 });
  } else if (phase === "Spécifique") {
    qualite.push(raide
      ? { type: "cotes", titre: "Côtes longues (allure course)", detail: "Montées longues à l'effort de la course, avec bâtons si tu en prends", minutes: 75, seance: "5 × 800 m à 7 %" }
      : course.dplus_m > 150
        ? { type: "cotes", titre: "Côtes moyennes", detail: "Montées soutenues, retour en trottinant", minutes: 65, seance: "8 × 400 m à 6 %" }
        : { type: "seuil", titre: "Seuil", detail: "Échauffement 20 min, 3 × 10 min à allure semi-marathon, 2 min de récupération", minutes: 65 });
    qualite.push(raide
      ? { type: "descentes", titre: "Descentes (quadriceps)", detail: "Descentes rapides en relâchant, remontées en marchant", minutes: 60, seance: "6 × 400 m à 8 %" }
      : { type: "seuil", titre: "Allure course", detail: `${q.objectif === "performance" ? "3 × 15" : "2 × 15"} min à l'allure visée le jour J`, minutes: 70 });
  } else {
    qualite.push({ type: "seuil", titre: "Rappel d'allure", detail: "Échauffement, 3 × 6 min à l'allure de course, retour au calme", minutes: 50 });
  }
  res.push(...qualite.slice(0, dures));
  // le reste en footing facile (la règle des 80/20), jamais plus long que la sortie longue
  const restant = Math.max(0, q.seances - res.length);
  const minutesRestantes = Math.max(0, ke * allure - res.reduce((t, s) => t + s.minutes, 0));
  const plafondFooting = Math.min({ debutant: 50, intermediaire: 75, confirme: 90 }[q.niveau], longueMin * 0.7);
  for (let i = 0; i < restant; i++) {
    const m = Math.min(Math.round(plafondFooting / 5) * 5, Math.max(30, Math.round(minutesRestantes / Math.max(restant, 1) / 5) * 5));
    res.push({ type: "footing", titre: `Footing ${heures(m)}`, detail: "Endurance facile : tu peux parler en courant", minutes: m,
               sortie: { km: Math.max(4, Math.round(m / allure)), relief: "plat" } });
  }
  return res;
}

function heures(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** « trail 30 km 1500 m », « 42 km », « 80 km 3500 D+ » → distance et D+ (null si illisible). */
export function lireFormat(texte: string): { distance_km: number; dplus_m: number } | null {
  const t = texte.toLowerCase().replace(",", ".");
  const d = t.match(/(\d+(?:\.\d+)?)\s*(?:km|k)\b/);
  if (!d) return null;
  const reste = t.replace(d[0], " ");
  const p = reste.match(/(\d{2,5})\s*(?:m\b|d\+|m\s*d\+|mètres)/) ?? reste.match(/d\+\s*(\d{2,5})/);
  const distance = parseFloat(d[1]);
  if (!(distance > 0 && distance < 500)) return null;
  return { distance_km: distance, dplus_m: p ? parseInt(p[1], 10) : 0 };
}
