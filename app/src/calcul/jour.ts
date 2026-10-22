// Accueil : la séance du jour (d'après mon plan), le petit mot de la semaine, et le message
// « Je pars courir » pour prévenir un proche.

import type { Seance, Semaine } from "./plan.ts";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lundi de la semaine (heure locale), au format AAAA-MM-JJ. */
export function lundiDe(d: Date): string {
  const l = new Date(d);
  l.setHours(12, 0, 0, 0);
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
  return iso(l);
}

/** Jours restants dans la semaine, aujourd'hui compris (lundi : 7, dimanche : 1). */
export const joursRestants = (d: Date) => 7 - ((d.getDay() + 6) % 7);

export type SeanceDuJour =
  | { cas: "pas_de_plan" }
  | { cas: "course"; nom: string }
  | { cas: "avant_plan"; debut: string } // le plan commence plus tard
  | { cas: "fini" } // course passée
  | { cas: "seance"; seance: Seance; rang: number; total: number; semaine: Semaine }
  | { cas: "semaine_faite"; semaine: Semaine };

/**
 * Séance proposée aujourd'hui : la prochaine séance de la semaine du plan qui n'est pas encore
 * faite (`faites` = sorties validées depuis lundi), dans l'ordre du plan (les séances clés d'abord).
 */
export function seanceDuJour(plan: Semaine[] | null, faites: number, nomCourse: string, dateCourse: string | undefined,
                             aujourdHui = new Date()): SeanceDuJour {
  if (!plan?.length) return { cas: "pas_de_plan" };
  const jour = iso(aujourdHui);
  if (dateCourse && jour === dateCourse) return { cas: "course", nom: nomCourse };
  if (dateCourse && jour > dateCourse) return { cas: "fini" };
  const semaine = plan.find((s) => s.debut === lundiDe(aujourdHui));
  if (!semaine) return jour < plan[0].debut ? { cas: "avant_plan", debut: plan[0].debut } : { cas: "fini" };
  const aFaire = semaine.seances.filter((s) => s.type !== "repos" && s.type !== "course");
  if (faites >= aFaire.length) return { cas: "semaine_faite", semaine };
  return { cas: "seance", seance: aFaire[faites], rang: faites + 1, total: aFaire.length, semaine };
}

/** Petit mot de la semaine : encouragement selon les entraînements faits et ceux qui restent. */
export function petitMot(faites: number, objectif: number, prenom: string, aujourdHui = new Date()): string {
  const reste = objectif - faites;
  const jours = joursRestants(aujourdHui);
  const qui = prenom && prenom !== "Coureur" ? `${prenom}, t'es` : "T'es";
  if (reste <= 0) return `Semaine bouclée : ${faites} entraînement${faites > 1 ? "s" : ""} sur ${objectif}. ${qui} au top, profite de la récup !`;
  const encore = `encore ${reste} entraînement${reste > 1 ? "s" : ""} cette semaine`;
  if (faites === 0) {
    return jours <= reste
      ? `Il reste ${jours} jour${jours > 1 ? "s" : ""} pour ${reste} séance${reste > 1 ? "s" : ""} : garde la plus importante, la régularité compte plus que tout.`
      : `Nouvelle semaine, ${objectif} entraînements au programme. C'est parti !`;
  }
  if (reste === 1) return `${qui} le meilleur ! Plus qu'un entraînement et ta semaine est bouclée.`;
  if (reste > jours) return `${qui} sur la bonne voie : ${encore}, il reste ${jours} jour${jours > 1 ? "s" : ""}. Garde les séances clés.`;
  return `${qui} le meilleur ! ${encore[0].toUpperCase()}${encore.slice(1)}.`;
}

const heure = (d: Date) => `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * Message à envoyer à un proche avant de partir : heure de départ, retour prévu, point de départ
 * (lien de carte), et quand s'inquiéter (30 min après le retour prévu).
 */
export function messageDepart(minutes: number, lieu: { nom: string; lat: number; lon: number; gps: boolean }, maintenant = new Date()): string {
  const retour = new Date(maintenant.getTime() + minutes * 60000);
  const alerte = new Date(retour.getTime() + 30 * 60000);
  const lien = `https://www.openstreetmap.org/?mlat=${lieu.lat.toFixed(5)}&mlon=${lieu.lon.toFixed(5)}#map=15/${lieu.lat.toFixed(5)}/${lieu.lon.toFixed(5)}`;
  return `Je pars courir à ${heure(maintenant)}, retour prévu vers ${heure(retour)}. `
    + `Départ : ${lieu.gps ? "ma position" : lieu.nom} ${lien} . `
    + `Si tu n'as pas de nouvelles à ${heure(alerte)}, appelle-moi.`;
}
