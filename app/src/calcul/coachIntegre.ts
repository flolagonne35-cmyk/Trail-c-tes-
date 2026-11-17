// Coach intégré : répond tout de suite, sur le téléphone, sans réseau ni IA, à partir du programme
// du coureur. Il reconnaît le sujet de la question (douleur, fatigue, séance du jour, nutrition,
// objectif, allure, météo, veille de course…) et applique les règles d'entraînement de l'appli.
// Rien n'est envoyé nulle part. Quand la question sort de ce qu'il sait, il le dit et propose le
// coach en ligne ou l'assistant IA du coureur.
//
// Repères utilisés (les mêmes que le programme) : Seiler 2010 (80/20), Frandsen/Nielsen 2025 (pas
// plus de 10 % au-dessus de la plus longue sortie récente), Jeukendrup 2014 et ACSM 2016
// (glucides), ACSM 2007 (hydratation), Riegel 1981 (prédiction de temps), règle du « cou » pour
// courir malade (Eichner, Weidner : symptômes au-dessus du cou seulement, sans fièvre).

import { riegel, tempsLisible } from "./allures.ts";
import { fourchetteGlucides } from "./nutrition.ts";
import {
  allures, allureTexte, faisabilite, JOURS, kmEffort, meilleurVdot, RECORDS, semainesAvant,
  type CourseCible, type Questionnaire, type Seance, type Semaine,
} from "./plan.ts";

export type Situation = {
  cible: CourseCible | null; questionnaire: Questionnaire | null; plan: Semaine[] | null; semaine: Semaine | null;
  seanceDuJour: Seance | null; repos: boolean; allureMinKm: number; aujourdHui?: Date;
};
export type Sujet = "urgence" | "douleur" | "malade" | "fatigue" | "manquee" | "nutrition" | "objectif" | "allure" | "seance"
  | "meteo" | "veille" | "renfo" | "materiel" | "inconnu";

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// l'ordre compte : la santé passe avant tout le reste
const SUJETS: [Sujet, RegExp][] = [
  ["urgence", /poitrine|malaise|vertige|evanoui|palpitation|essouffle(ment)? (inhabituel|anormal)|douleur thoracique/],
  ["douleur", /\bmal (au|a la|aux|a l)|douleur|blessure|blesse|tendin|periost|entorse|contracture|dechirure|boite|genou|cheville|tibia|talon|hanche|tendon|aponevr|syndrome/],
  ["malade", /fievre|grippe|rhume|malade|covid|angine|gastro|toux|bronchite/],
  ["fatigue", /fatigu|creve|epuise|lessive|mal dormi|pas dormi|nuit blanche|courbatu|jambes lourdes|pas envie|motivation|surentrain|a plat/],
  ["manquee", /manque|rate|loupe|pas pu|saute|rattrap|pas fait|pas eu le temps/],
  ["veille", /veille|jour j|affutage|derniere semaine|stress|avant la course|matin de la course/],
  ["nutrition", /mange|manger|boire|bois|\bgels?\b|nutrition|ravito|glucide|hydrat|petit.?dej|repas|sodium|\bsel\b|cafeine|crampe/],
  ["objectif", /realiste|capable|\bpret\b|objectif|chrono|quel temps|finir|temps viser|j.y arriverai/],
  ["allure", /allure|vitesse|rythme|a combien|trop vite|trop lent/],
  ["meteo", /chaud|chaleur|canicule|froid|pluie|vent\b|neige|verglas|\bnuit\b|orage/],
  ["renfo", /renfo|gainage|muscu|etirement|squat|fente|mobilite/],
  ["materiel", /chaussure|baton|\bsac\b|frontale|montre|tenue/],
  ["seance", /seance|aujourd|explique|pourquoi|a quoi sert|fractionne|seuil|cotes?\b|sortie longue|footing|programme|semaine/],
];

export function sujetDe(question: string): Sujet {
  const q = sansAccents(question);
  return SUJETS.find(([, re]) => re.test(q))?.[0] ?? "inconnu";
}

const h = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`);
const nomSeance = (s: Seance) => `${s.titre.toLowerCase()}${s.seance ? ` (${s.seance})` : ""}`;
const dure = (s: Seance | null) => !!s && s.type !== "footing" && s.type !== "longue" && s.type !== "repos";

/** À quoi sert chaque type de séance, et comment la réussir. */
const POURQUOI: Record<Seance["type"], string> = {
  longue: "Elle habitue ton corps à durer : il apprend à brûler les graisses et tes tendons se renforcent. Reste en aisance respiratoire : tu dois pouvoir parler. Si tu finis épuisé, c'était trop vite.",
  cotes: "Les côtes développent la force sans la casse du sprint sur le plat. Monte de façon tonique mais régulière, la dernière répétition aussi propre que la première, et redescends en trottinant.",
  descentes: "En trail, ce sont les descentes qui détruisent les cuisses. Les travailler à l'entraînement protège tes quadriceps le jour J. Descends relâché, petits pas rapides, remonte en marchant.",
  seuil: "Le seuil est l'allure que tu peux tenir environ une heure : la travailler fait reculer la fatigue à allure de course. C'est soutenu mais maîtrisé : tu peux dire quelques mots, pas tenir une conversation.",
  vma: "Le fractionné court développe ta vitesse maximale et rend les autres allures plus faciles. Vite mais pas à fond : garde la même vitesse sur toutes les répétitions.",
  footing: "Le footing facile fait 80 % du travail : il construit l'endurance et te fait récupérer des séances dures. Va vraiment lentement, sans regarder l'allure.",
  repos: "Le repos fait partie de l'entraînement : c'est là que le corps se renforce.",
  course: "C'est le jour J : pars un peu moins vite que ton envie, mange et bois dès la première heure.",
};

function allegement(s: Situation): string {
  const x = s.seanceDuJour;
  if (!x) return "Aujourd'hui, rien de dur n'est prévu : marche, dors, et reprends demain.";
  if (dure(x)) return `Remplace ta séance (${nomSeance(x)}) par un footing très facile de 30 à 40 min, ou par du repos. Ne la reporte pas à demain si une autre séance clé suit : une séance dure perdue ne change rien, deux séances dures collées font des dégâts.`;
  if (x.type === "longue") return `Garde ta sortie longue mais raccourcie d'un tiers (environ ${h(x.minutes * 0.67)}) et très lente. Si tu te sens mal au bout de 20 min, rentre.`;
  return `Ton footing peut passer à 30 min très lent, ou sauter : un footing manqué ne se rattrape pas.`;
}

export function repondre(question: string, s: Situation): { sujet: Sujet; texte: string } {
  const sujet = sujetDe(question);
  const q = s.questionnaire;
  const al = q ? (() => { const v = meilleurVdot(q.records); return v ? allures(v) : null; })() : null;
  const x = s.seanceDuJour;
  const sansPlan = "Je n'ai pas encore ton programme : crée-le dans « Mon plan » et je pourrai te répondre avec tes séances et tes allures.";
  const texte = ((): string => {
    switch (sujet) {
      case "urgence":
        return "Arrête-toi tout de suite. Une douleur dans la poitrine, un malaise, des vertiges ou un essoufflement anormal à l'effort ne se discutent pas avec une appli : appelle le 15 (ou le 112) si ça ne passe pas en quelques minutes, et vois un médecin avant de recourir.";
      case "douleur":
        return "Je ne peux pas dire ce que c'est : seul un médecin ou un kiné le peut. La règle des coureurs : si la douleur dépasse 3 sur 10, si elle augmente en courant ou si elle te fait boiter, tu arrêtes la séance et tu ne cours pas tant qu'elle est là. "
          + "Si elle est légère et disparaît à l'échauffement, tu peux faire un footing court sur sol souple, sans côtes ni vitesse. Elle dure plus de 3 à 5 jours ou revient à chaque sortie : consulte. En attendant, vélo ou natation gardent la forme sans chocs.";
      case "malade":
        return "Règle simple : symptômes au-dessus du cou seulement (nez qui coule, gorge qui gratte) et pas de fièvre, un footing très léger est possible. Fièvre, courbatures, toux grasse ou ventre dérangé : repos complet, et pas de séance dure avant 2 ou 3 jours sans symptômes. "
          + "Courir avec de la fièvre fatigue le cœur. Tu ne perds pas ta forme en une semaine.";
      case "fatigue":
        return `Un mauvais jour n'est pas grave, ignorer la fatigue l'est. ${allegement(s)} Si la fatigue dure plus d'une semaine avec un sommeil perturbé ou un pouls au réveil plus haut que d'habitude, prends 3 à 4 jours très légers.`;
      case "manquee":
        return "Une séance manquée ne se paie pas. Un footing manqué : tu l'oublies. Une séance clé (sortie longue, séance dure) : tu peux la faire un autre jour de la semaine, à condition de garder un jour facile avant et après. "
          + "Ne fais jamais deux séances dures de suite pour « rattraper », et n'allonge pas les autres séances. Plus d'une semaine sans courir : reprends une semaine en dessous de là où tu en étais.";
      case "veille":
        return "La dernière semaine, le travail est fait : on arrive frais. Footings courts, 3 ou 4 accélérations de 20 secondes 2 à 3 jours avant, et rien de nouveau (chaussures, nourriture). "
          + "La veille : repas simple et riche en féculents, pas d'alcool, sac et dossard prêts le soir. Le matin : petit-déjeuner déjà testé 3 heures avant le départ, puis pars un peu moins vite que ton envie. Ta feuille de course est dans Courses → Ma course → Jour J.";
      case "nutrition": {
        const minutes = x?.minutes ?? (s.semaine?.seances.find((z) => z.type === "longue")?.minutes ?? 60);
        const [bas, haut] = fourchetteGlucides(minutes / 60);
        const pendant = minutes < 60 ? `Pour ${h(minutes)}, de l'eau suffit.`
          : `Pour ${h(minutes)} : ${bas} à ${haut} g de glucides par heure (un gel fait 25 g) et 400 à 800 ml d'eau par heure selon la chaleur, en petites prises toutes les 15 à 20 min, dès la première demi-heure.`;
        return `Avant : un repas ou une collation riche en glucides et pauvre en gras et en fibres, 2 à 3 heures avant (pain, riz, banane). ${pendant} `
          + "Après : glucides et protéines dans l'heure (laitage et fruit, sandwich). Pour tes chiffres à toi (sueur, sel, produits), va dans Courses → Ma course → Nutrition.";
      }
      case "objectif": {
        if (!s.cible || !q || !s.plan) return sansPlan;
        const semaines = semainesAvant(s.cible.date, s.aujourdHui);
        const alerte = faisabilite(s.cible, q, s.plan, s.allureMinKm);
        const route = s.cible.dplus_m / Math.max(s.cible.distance_km, 1) < 10;
        const rec = RECORDS.filter(([k]) => q.records?.[k]).map(([k, , d]) => ({ d, t: q.records![k]! }));
        const prediction = route && rec.length
          ? ` D'après ton record sur ${rec.at(-1)!.d < 22 ? `${Math.round(rec.at(-1)!.d)} km` : "marathon"}, tu vaux environ ${tempsLisible(riegel(rec.at(-1)!.t, rec.at(-1)!.d, s.cible.distance_km))} sur ${s.cible.distance_km} km (formule de Riegel, à entraînement égal).`
          : ` En trail, le temps dépend surtout du dénivelé : compte environ ${h(kmEffort(s.cible.distance_km, s.cible.dplus_m) * s.allureMinKm)} à ton allure d'endurance, ravitos compris en plus.`;
        return alerte ? `${alerte}${prediction}`
          : `Oui, c'est jouable : il te reste ${semaines} semaines et ton programme monte assez haut pour ${s.cible.nom}, si tu fais au moins 3 séances sur 4 sans te blesser.${prediction} La régularité compte plus que les séances héroïques.`;
      }
      case "allure":
        return al
          ? `Tes allures, d'après tes records : footing et sortie longue ${allureTexte(al.facile[0])} à ${allureTexte(al.facile[1])} au km, allure marathon ${allureTexte(al.marathon)}, seuil ${allureTexte(al.seuil)}, fractionné ${allureTexte(al.vma)}. `
            + "En côte et sur sentier, oublie l'allure : garde le même effort (souffle, sensations). Si tu ne peux pas parler pendant un footing, tu vas trop vite."
          : "Sans tes records, je ne peux pas chiffrer : ajoute un temps récent (5 km, 10 km, semi ou marathon) dans « Mon plan » → Modifier mes réponses. En attendant, le repère est le souffle : footing = tu peux parler ; seuil = quelques mots ; fractionné = plus un mot.";
      case "meteo":
        return "Chaleur (plus de 25 °C) : cours tôt ou tard, ralentis de 10 à 20 secondes au km, bois davantage et raccourcis la séance dure. Froid : trois couches fines, bonnet et gants, échauffement plus long. "
          + "Pluie : rien ne change sauf les appuis en descente. Orage ou verglas : on reporte, sans regret. De nuit : frontale et vêtements réfléchissants, et préviens un proche (Programme → Sorties).";
      case "renfo":
        return `${s.semaine?.complement ?? "Deux séances de 20 min par semaine, les jours sans séance dure : gainage, fentes, montées sur pointes (mollets), squats lents à la descente."} `
          + "Le renforcement réduit les blessures de surcharge de près de moitié. Les étirements, eux, ne préviennent pas les blessures : fais-les doucement, loin des séances, si tu aimes ça.";
      case "materiel":
        return "Chaussures : celles dans lesquelles tu es bien, changées vers 700 à 900 km ; jamais neuves le jour de la course. Bâtons : utiles au-delà de 1 000 m de D+ si tu t'en sers à l'entraînement. "
          + "Sac : essaie-le chargé sur une sortie longue. Frontale : 200 lumens au moins pour courir sur sentier. La liste de ta course est dans Courses → Ma course → Jour J.";
      case "seance": {
        if (!s.plan) return sansPlan;
        if (x) {
          const allure = al && x.type === "seuil" ? ` Ton allure seuil : ${allureTexte(al.seuil)} au km.`
            : al && (x.type === "footing" || x.type === "longue") ? ` Ton allure : ${allureTexte(al.facile[0])} à ${allureTexte(al.facile[1])} au km.` : "";
          return `Aujourd'hui : ${nomSeance(x)}, environ ${h(x.minutes)}. ${x.detail}. ${POURQUOI[x.type]}${allure}`;
        }
        const prochaine = s.semaine?.seances.find((z) => z.jour !== undefined && z.jour > (((s.aujourdHui ?? new Date()).getDay() + 6) % 7));
        return s.repos ? `Aujourd'hui, c'est repos. ${POURQUOI.repos}${prochaine ? ` Prochaine séance ${JOURS[prochaine.jour!].toLowerCase()} : ${nomSeance(prochaine)}.` : ""}`
          : `Cette semaine (${s.semaine?.phase.toLowerCase() ?? "hors plan"}) : ${s.semaine?.seances.map(nomSeance).join(" ; ") ?? "pas de séance prévue"}.`;
      }
      default:
        return "Je réponds tout de suite sur : ta séance du jour, la fatigue, une douleur, une séance manquée, la nutrition, tes allures, ton objectif, la météo, la veille de course, le renforcement et le matériel. "
          + "Pour une autre question, utilise le coach en ligne ou ton assistant IA (boutons ci-dessous).";
    }
  })();
  return { sujet, texte };
}
