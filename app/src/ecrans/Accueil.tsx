// Rubrique « Aujourd'hui » : une seule question, « qu'est-ce que je fais aujourd'hui ? ». De haut en
// bas : la séance du jour (tirée de mon programme), ma semaine (faite / prévue), ma prochaine course,
// et la lumière du jour (frontale ?). Le reste a sa rubrique : courses dans Courses, points dans Mon
// monde, « Je pars courir » au moment de partir (Programme → Sorties).

import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { joursAvant, type CourseInscrite } from "../calcul/calendrier.ts";
import type { Position } from "../calcul/geo.ts";
import { petitMot, seanceDuJour } from "../calcul/jour.ts";
import { genererPlan, JOURS, type Seance } from "../calcul/plan.ts";
import { heureLisible, soleil } from "../calcul/soleil.ts";
import { nombre, type Destination } from "../composants/communs.tsx";
import type { MonPlan } from "../monPlan.ts";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";
import type { VueCourse } from "./Course.tsx";

function semaine(profil: Profil) {
  const lundi = new Date();
  lundi.setHours(0, 0, 0, 0);
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const a = profil.activites.filter((x) => x.statut === "validee" && new Date(x.date) >= lundi);
  return { km: a.reduce((s, x) => s + x.distance_km, 0), dplus: a.reduce((s, x) => s + x.dplus_m, 0), sorties: a.length };
}

const jourCourt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={[S.carte, { gap: 12, padding: 18 }]}>
      <Text style={[S.surtitre, { fontSize: 12 }]} accessibilityRole="header">{titre}</Text>
      {children}
    </View>
  );
}

/** Séance du jour, tirée du plan d'entraînement de ma course (Programme → Mon programme). */
function SeanceDuJourCarte({ monPlan, faites, allurePlat, aller, onSeance, onSortie, onMaCourse }: {
  monPlan: MonPlan; faites: number; allurePlat: number; aller: (d: Destination) => void;
  onSeance: (texte: string) => void; onSortie: (p: NonNullable<Seance["sortie"]>) => void; onMaCourse: (v: VueCourse) => void;
}) {
  const { cible, questionnaire } = monPlan;
  const plan = useMemo(() => (cible && questionnaire ? genererPlan(cible, questionnaire, allurePlat) : null), [cible, questionnaire, allurePlat]);
  const r = seanceDuJour(plan, faites, cible?.nom ?? "", cible?.date);
  const bouton = (texte: string, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={S.bouton}><Text style={S.boutonTexte}>{texte}</Text></Pressable>
  );
  if (r.cas === "pas_de_plan" || r.cas === "fini") {
    return (
      <Carte titre="Séance du jour">
        <Text style={S.fort}>{r.cas === "fini" ? "Ta course est passée : bravo !" : "Pas encore de plan d'entraînement"}</Text>
        <Text style={S.petit}>Choisis ta course objectif et réponds à quelques questions : chaque jour, l'appli te dit quoi faire et où.</Text>
        {bouton(r.cas === "fini" ? "Préparer la prochaine course" : "Créer mon plan", () => aller({ page: "programme", mode: "programme" }))}
      </Carte>
    );
  }
  if (r.cas === "course") {
    return (
      <Carte titre="Séance du jour">
        <Text style={[S.h2, { fontSize: 20 }]}>C'est le jour J : {r.nom} !</Text>
        <Text style={S.petit}>Échauffe-toi 10 à 15 min, pars prudemment et suis ton plan de nutrition.</Text>
        {bouton("Ma feuille de course", () => onMaCourse("passages"))}
      </Carte>
    );
  }
  if (r.cas === "avant_plan") {
    return (
      <Carte titre="Séance du jour">
        <Text style={S.fort}>Ton plan commence le {jourCourt(r.debut)}</Text>
        <Text style={S.petit}>D'ici là, cours comme d'habitude, sans forcer.</Text>
      </Carte>
    );
  }
  if (r.cas === "semaine_faite") {
    return (
      <Carte titre="Séance du jour">
        <Text style={S.fort}>Repos ou footing léger : ta semaine est faite</Text>
        <Text style={S.petit}>Semaine {r.semaine.n} · {r.semaine.phase.toLowerCase()}. La récupération fait partie de l'entraînement.</Text>
      </Carte>
    );
  }
  if (r.cas === "repos") {
    return (
      <Carte titre="Séance du jour">
        <Text style={[S.h2, { fontSize: 20 }]}>Repos aujourd'hui</Text>
        <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
          {r.prochaine ? `Prochaine séance ${JOURS[r.prochaine.jour!].toLowerCase()} : ${r.prochaine.titre.toLowerCase()}.`
            : "Plus de séance cette semaine : profites-en pour récupérer."}
        </Text>
        <Text style={S.petit}>Le repos fait partie de l'entraînement : c'est là que le corps progresse.</Text>
      </Carte>
    );
  }
  const x = r.seance;
  return (
    <Carte titre={`Séance du jour · ${r.rang}/${r.total} de la semaine`}>
      <Text style={[S.h2, { fontSize: 20 }]}>{x.titre}</Text>
      <Text style={[S.petit, { color: C.encre, fontSize: 14 }]}>{x.detail}</Text>
      <Text style={S.petit}>≈ {x.minutes} min · semaine {r.semaine.n} · {r.semaine.phase.toLowerCase()} · objectif {cible?.nom}</Text>
      {x.seance ? bouton("Où la faire autour de moi", () => onSeance(x.seance!))
        : x.sortie ? bouton("Voir les parcours autour de moi", () => onSortie(x.sortie!))
        : bouton("Voir mon programme", () => aller({ page: "programme", mode: "programme" }))}
    </Carte>
  );
}

/** Ma semaine : sorties faites sur sorties prévues, avec une barre simple, km et D+. */
function MaSemaine({ faites, prevues, km, dplus, mot }: { faites: number; prevues: number; km: number; dplus: number; mot: string }) {
  const part = Math.min(1, prevues ? faites / prevues : 0);
  return (
    <Carte titre="Ma semaine">
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ fontSize: 30, fontWeight: "800", color: C.encre }}>{faites}</Text>
        <Text style={[S.fort, { fontWeight: "600" }]}>sortie{faites > 1 ? "s" : ""} sur {prevues} prévue{prevues > 1 ? "s" : ""}</Text>
      </View>
      <View accessibilityRole="progressbar" aria-valuenow={faites} aria-valuemax={prevues}
            style={{ height: 12, borderRadius: 6, backgroundColor: C.aire, overflow: "hidden" }}>
        <View style={{ width: `${part * 100}%`, height: "100%", borderRadius: 6, backgroundColor: C.montee }} />
      </View>
      <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>{nombre(km, 1)} km · {nombre(dplus)} m de D+ depuis lundi</Text>
      <Text style={S.petit}>{mot}</Text>
    </Carte>
  );
}

/** Ma prochaine course : la course objectif du programme ou la plus proche de Ma saison. */
function ProchaineCourse({ monPlan, mesCourses, aller, onMaCourse }: {
  monPlan: MonPlan; mesCourses: CourseInscrite[]; aller: (d: Destination) => void; onMaCourse: (v: VueCourse) => void;
}) {
  const candidates = [
    ...(monPlan.cible?.date ? [{ nom: monPlan.cible.nom, date: monPlan.cible.date, objectif: true }] : []),
    ...mesCourses.filter((c) => c.statut !== "terminee").map((c) => ({ nom: c.nom, date: c.date, objectif: false })),
  ].filter((c) => joursAvant(c.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  const c = candidates[0];
  if (!c) {
    return (
      <Carte titre="Ma prochaine course">
        <Text style={S.fort}>Pas encore de course prévue</Text>
        <Pressable onPress={() => aller({ page: "courses", mode: "calendrier" })} accessibilityRole="button" style={S.boutonClair}>
          <Text style={S.boutonClairTexte}>Trouver une course</Text>
        </Pressable>
      </Carte>
    );
  }
  const j = joursAvant(c.date);
  return (
    <Carte titre="Ma prochaine course">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ alignItems: "center", minWidth: 72, paddingVertical: 8, borderRadius: 14, backgroundColor: C.monteeClair }}>
          <Text style={{ fontSize: 28, fontWeight: "900", color: C.monteeFonce }}>{j}</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.monteeFonce }}>jour{j > 1 ? "s" : ""}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[S.fort, { fontSize: 17 }]} numberOfLines={2}>{c.nom}</Text>
          <Text style={S.petit}>{jourCourt(c.date)}</Text>
        </View>
      </View>
      <Pressable onPress={() => onMaCourse("parcours")} accessibilityRole="button" style={S.boutonClair}>
        <Text style={S.boutonClairTexte}>Préparer ma course</Text>
      </Pressable>
    </Carte>
  );
}

/** Lumière du jour : lever, coucher, et le rappel de la frontale si la nuit tombe bientôt. */
function Lumiere({ position }: { position: Position }) {
  const maintenant = new Date();
  const s = soleil(maintenant, position);
  if (!s) return null;
  const minutesAvantNuit = (s.coucher.getTime() - maintenant.getTime()) / 60000;
  const conseil = minutesAvantNuit < 0 ? "Il fait nuit : frontale, vêtements clairs ou réfléchissants."
    : minutesAvantNuit < 120 ? `Nuit dans ${Math.floor(minutesAvantNuit / 60) ? `${Math.floor(minutesAvantNuit / 60)} h ` : ""}${Math.round(minutesAvantNuit % 60)} min : pour une sortie de plus d'une heure, prends ta frontale.`
    : "Assez de jour pour une sortie longue.";
  return (
    <Carte titre="Lumière du jour">
      <View style={{ flexDirection: "row", gap: 24 }}>
        <View><Text style={S.petit}>Lever</Text><Text style={[S.fort, { fontSize: 20 }]}>☀️ {heureLisible(s.lever)}</Text></View>
        <View><Text style={S.petit}>Coucher</Text><Text style={[S.fort, { fontSize: 20 }]}>🌙 {heureLisible(s.coucher)}</Text></View>
      </View>
      <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>{conseil}</Text>
    </Carte>
  );
}

export function EcranAccueil({ profil, aller, monPlan, allurePlat, mesCourses, position, onSeance, onSortie, onMaCourse }: {
  profil: Profil; aller: (d: Destination) => void; monPlan: MonPlan; allurePlat: number; mesCourses: CourseInscrite[];
  position: Position; onSeance: (texte: string) => void; onSortie: (p: NonNullable<Seance["sortie"]>) => void;
  onMaCourse: (v: VueCourse) => void;
}) {
  const s = semaine(profil);
  // objectif de la semaine : les séances choisies dans mon questionnaire, sinon 3
  const prevues = monPlan.questionnaire?.seances ?? 3;
  const date = useMemo(() => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), []);
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={[S.sousTitre, { marginTop: 0, fontSize: 16 }]}>Bonjour {profil.prenom}, nous sommes {date}.</Text>
      <SeanceDuJourCarte monPlan={monPlan} faites={s.sorties} allurePlat={allurePlat} aller={aller} onSeance={onSeance}
                         onSortie={onSortie} onMaCourse={onMaCourse} />
      <MaSemaine faites={s.sorties} prevues={prevues} km={s.km} dplus={s.dplus} mot={petitMot(s.sorties, prevues, profil.prenom)} />
      <ProchaineCourse monPlan={monPlan} mesCourses={mesCourses} aller={aller} onMaCourse={onMaCourse} />
      <Lumiere position={position} />
      <Text style={[S.petit, { marginTop: 16 }]}>
        Les sorties comptées sont celles ajoutées en GPX (Mon monde → Mon coureur) depuis lundi.
      </Text>
    </ScrollView>
  );
}
