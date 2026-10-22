// Onglet « Accueil » : mon coureur, mes points et ma semaine, un petit mot d'encouragement, la
// séance du jour (d'après mon plan) et « Je pars courir » pour prévenir un proche. Les rubriques de
// l'appli sont dans les onglets du bas et le menu ☰ : l'accueil ne les répète pas.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Avatar } from "../avatar/Avatar.tsx";
import { score } from "../calcul/points.ts";
import { coursesAVenir, FILTRES_AGENDA, formatsLisibles } from "../calcul/agenda.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { messageDepart, petitMot, seanceDuJour } from "../calcul/jour.ts";
import { genererPlan, type Seance } from "../calcul/plan.ts";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
import type { PointDepart } from "../composants/BarreDepart.tsx";
import { partagerTexte } from "../fichiers.ts";
import type { MonPlan } from "../monPlan.ts";
import type { Destination } from "../composants/Menu.tsx";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";
import { AGENDA } from "./Agenda.tsx";

function semaine(profil: Profil) {
  const lundi = new Date();
  lundi.setHours(0, 0, 0, 0);
  lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
  const a = profil.activites.filter((x) => x.statut === "validee" && new Date(x.date) >= lundi);
  return { km: a.reduce((s, x) => s + x.distance_km, 0), dplus: a.reduce((s, x) => s + x.dplus_m, 0),
           points: a.reduce((s, x) => s + x.points, 0), sorties: a.length };
}

function Bandeau({ profil, onPress }: { profil: Profil; onPress: () => void }) {
  const { valides } = score(profil.activites);
  const s = semaine(profil);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Mon profil, ${valides} points`}
               style={{ marginTop: 12, borderRadius: 24, overflow: "hidden", backgroundColor: C.encre, minHeight: 200 }}>
      {/* relief en fond : deux lignes de crêtes et le soleil */}
      <Svg width="100%" height="100%" viewBox="0 0 350 200" preserveAspectRatio="xMidYMax slice"
           style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id="crete" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2E4A3B" /><Stop offset="1" stopColor={C.encre} />
          </LinearGradient>
        </Defs>
        <Circle cx={292} cy={52} r={26} fill={C.montee} opacity={0.9} />
        <Path d="M0 150 L60 105 L95 130 L150 70 L205 125 L245 98 L300 140 L350 112 L350 200 L0 200 Z" fill="#253D30" />
        <Path d="M0 175 L45 150 L90 168 L140 128 L190 160 L235 140 L290 170 L350 150 L350 200 L0 200 Z" fill="url(#crete)" />
        <Path d="M140 128 L150 136 L160 131" stroke="#F4F1EA" strokeWidth={2} fill="none" opacity={0.5} />
      </Svg>
      <View style={{ flexDirection: "row", padding: 18, gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.fond, fontSize: 26, fontWeight: "800" }} numberOfLines={1}>Salut {profil.prenom}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 10 }}>
            <Text style={{ color: C.fond, fontSize: 40, fontWeight: "800" }}>{nombre(valides)}</Text>
            <Text style={{ color: "#F4F1EAB3", fontSize: 15, fontWeight: "700" }}>points</Text>
          </View>
          <Text style={{ color: "#F4F1EAD9", fontSize: 13, marginTop: 6 }}>
            Cette semaine : {nombre(s.km, 1)} km · {nombre(s.dplus)} m D+ · {s.sorties} sortie{s.sorties > 1 ? "s" : ""}
          </Text>
        </View>
        <Avatar a={profil.apparence} taille={112} fond={false} />
      </View>
    </Pressable>
  );
}

const DUREES: [string, string][] = [["45", "45 min"], ["60", "1 h"], ["90", "1 h 30"], ["120", "2 h"], ["180", "3 h"]];
const jourCourt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={[S.carte, { gap: 10, padding: 16 }]}>
      <Text style={[S.surtitre, { fontSize: 12 }]} accessibilityRole="header">{titre}</Text>
      {children}
    </View>
  );
}

/** Séance du jour, tirée du plan d'entraînement de ma course (Course → Plan). */
function SeanceDuJourCarte({ monPlan, faites, allurePlat, aller, onSeance, onSortie }: {
  monPlan: MonPlan; faites: number; allurePlat: number; aller: (d: Destination) => void;
  onSeance: (texte: string) => void; onSortie: (p: NonNullable<Seance["sortie"]>) => void;
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
        <Text style={S.petit}>Choisis ta course et réponds au mini questionnaire : l'appli te propose chaque jour la séance à faire.</Text>
        {bouton(r.cas === "fini" ? "Préparer la prochaine course" : "Créer mon plan", () => aller({ page: "course" }))}
      </Carte>
    );
  }
  if (r.cas === "course") {
    return (
      <Carte titre="Séance du jour">
        <Text style={[S.h2, { fontSize: 20 }]}>C'est le jour J : {r.nom} !</Text>
        <Text style={S.petit}>Échauffe-toi 10 à 15 min, pars prudemment et suis ton plan de nutrition.</Text>
        {bouton("Ma nutrition de course", () => aller({ page: "nutrition" }))}
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
  const x = r.seance;
  return (
    <Carte titre={`Séance du jour · ${r.rang}/${r.total} de la semaine`}>
      <Text style={[S.h2, { fontSize: 20 }]}>{x.titre}</Text>
      <Text style={[S.petit, { color: C.encre, fontSize: 14 }]}>{x.detail}</Text>
      <Text style={S.petit}>≈ {x.minutes} min · semaine {r.semaine.n} · {r.semaine.phase.toLowerCase()} · objectif {cible?.nom}</Text>
      {x.seance ? bouton("Où la faire", () => onSeance(x.seance!))
        : x.sortie ? bouton("Préparer ma sortie", () => onSortie(x.sortie!))
        : bouton("Voir mon plan", () => aller({ page: "course" }))}
    </Carte>
  );
}

/** Les 3 prochaines courses à moins de 30 km du point de départ (calendrier « Courses à venir »). */
function CoursesPres({ depart, aller }: { depart: PointDepart; aller: (d: Destination) => void }) {
  const proches = useMemo(() => coursesAVenir(AGENDA, depart.position, { ...FILTRES_AGENDA, rayonKm: 30, moisMax: 3 }).slice(0, 3),
                          [depart.position]);
  return (
    <Carte titre={`Courses près de ${depart.gps ? "chez toi" : depart.nom}`}>
      {!proches.length && <Text style={S.petit}>Aucune course connue à moins de 30 km dans les 3 prochains mois.</Text>}
      {proches.map((c) => (
        <Pressable key={c.id} onPress={() => aller({ page: "agenda" })} accessibilityRole="button"
                   accessibilityLabel={`${c.nom}, ${c.commune}, le ${jourCourt(c.date)}`}
                   style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 46, alignItems: "center", backgroundColor: c.type === "trail" ? C.monteeClair : C.platClair, borderRadius: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: C.encre }}>{new Date(`${c.date}T12:00:00`).getDate()}</Text>
            <Text style={{ fontSize: 11, fontWeight: "700", color: C.gris }}>{new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { month: "short" })}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={S.fort} numberOfLines={1}>{c.nom}</Text>
            <Text style={S.petit} numberOfLines={1}>
              {c.commune} · à {kmLisibles(c.distance_m)}{c.distances_km.length ? ` · ${formatsLisibles(c.distances_km)}` : ""}
            </Text>
          </View>
          <Icone nom="fleche" couleur={C.gris} taille={18} />
        </Pressable>
      ))}
      <Pressable onPress={() => aller({ page: "agenda" })} accessibilityRole="button" style={S.boutonClair}>
        <Text style={S.boutonClairTexte}>Toutes les courses à venir</Text>
      </Pressable>
    </Carte>
  );
}

/** « Je pars courir » : un message pour un proche (heure de retour, point de départ), envoyé par moi. */
function JeParsCourir({ depart }: { depart: PointDepart }) {
  const [duree, setDuree] = useState("60");
  return (
    <Carte titre="Sécurité">
      <Text style={S.fort}>Je pars courir</Text>
      <Text style={S.petit}>
        Préviens un proche : heure de départ, retour prévu et point de départ ({depart.gps ? "ta position" : depart.nom}).
        Rien n'est envoyé sans toi : tu choisis le contact dans le message.
      </Text>
      <Text style={[S.fort, { fontWeight: "600" }]}>Durée prévue</Text>
      <Segments options={DUREES} valeur={duree} onChange={setDuree} />
      <Pressable onPress={() => partagerTexte("Je pars courir", messageDepart(Number(duree), { nom: depart.nom, ...depart.position, gps: depart.gps }))}
                 accessibilityRole="button" style={[S.bouton, { flexDirection: "row", gap: 8 }]}>
        <Icone nom="position" couleur={C.fond} taille={18} />
        <Text style={S.boutonTexte}>Prévenir un proche</Text>
      </Pressable>
    </Carte>
  );
}

export function EcranAccueil({ profil, aller, monPlan, depart, allurePlat, onSeance, onSortie }: {
  profil: Profil; aller: (d: Destination) => void; monPlan: MonPlan; depart: PointDepart; allurePlat: number;
  onSeance: (texte: string) => void; onSortie: (p: NonNullable<Seance["sortie"]>) => void;
}) {
  const s = semaine(profil);
  // objectif de la semaine : les séances choisies dans mon questionnaire, sinon 3
  const objectif = monPlan.questionnaire?.seances ?? 3;
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Bandeau profil={profil} onPress={() => aller({ page: "profil" })} />
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: C.monteeClair }}>
        <Text style={{ fontSize: 22 }}>💪</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: C.monteeFonce }}>{petitMot(s.sorties, objectif, profil.prenom)}</Text>
      </View>
      <SeanceDuJourCarte monPlan={monPlan} faites={s.sorties} allurePlat={allurePlat} aller={aller} onSeance={onSeance} onSortie={onSortie} />
      <CoursesPres depart={depart} aller={aller} />
      <JeParsCourir depart={depart} />
      <Text style={[S.petit, { marginTop: 14 }]}>
        Les entraînements comptés sont tes sorties ajoutées en GPX (Profil) depuis lundi.
      </Text>
    </ScrollView>
  );
}
