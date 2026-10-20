// Onglet « Accueil » : mon coureur et ma semaine, puis tout ce que fait l'appli, rangé par catégorie
// (comme le menu), et les côtes proches.

import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Avatar } from "../avatar/Avatar.tsx";
import { joursAvant, prochaine, type CourseInscrite } from "../calcul/calendrier.ts";
import { kmLisibles, type CoteProche } from "../calcul/cotes.ts";
import { score } from "../calcul/points.ts";
import { Icone, nombre, Section } from "../composants/communs.tsx";
import type { Destination } from "../composants/Menu.tsx";
import { couleurPente } from "../composants/Carte.tsx";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

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

function Tuile({ icone, titre, texte, onPress, accent }: {
  icone: Parameters<typeof Icone>[0]["nom"]; titre: string; texte: string; onPress: () => void; accent?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titre}. ${texte}`}
               style={({ pressed }) => ({ flex: 1, minWidth: 0, borderRadius: 18, padding: 14, gap: 10, minHeight: 128,
                                          backgroundColor: accent ? C.montee : C.blanc, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
                     backgroundColor: accent ? "#FFFFFF33" : C.monteeClair }}>
        <Icone nom={icone} couleur={accent ? C.blanc : C.monteeFonce} />
      </View>
      <View>
        <Text style={{ fontSize: 16, fontWeight: "800", color: accent ? C.blanc : C.encre }}>{titre}</Text>
        <Text style={{ fontSize: 12, marginTop: 2, color: accent ? "#FFFFFFD9" : C.gris }}>{texte}</Text>
      </View>
    </Pressable>
  );
}

function Categorie({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18, gap: 8 }}>
      <Text style={[S.surtitre, { fontSize: 12 }]}>{titre}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>
    </View>
  );
}

export function EcranAccueil({ profil, proches, lieu, nbCotes, aller, ouvrirCote, courses }: {
  profil: Profil; proches: CoteProche[]; lieu: string; nbCotes: number;
  aller: (d: Destination) => void; ouvrirCote: (c: CoteProche, rang: number) => void; courses: CourseInscrite[];
}) {
  const suivante = prochaine(courses);
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Bandeau profil={profil} onPress={() => aller({ page: "profil" })} />

      <Categorie titre="S'entraîner">
        <Tuile accent icone="boucle" titre="Créer une boucle" texte="Distance, côtes, D+ : GPX pour la montre"
               onPress={() => aller({ page: "entrainement", mode: "boucle" })} />
        <Tuile icone="seance" titre="Séance du coach" texte="« 8 × 400 m à 10 % » : où la faire"
               onPress={() => aller({ page: "entrainement", mode: "seance" })} />
      </Categorie>
      <Categorie titre="Explorer">
        <Tuile icone="cotes" titre="Côtes" texte={`${nbCotes} mesurées au mètre près`} onPress={() => aller({ page: "cotes", mode: "montee" })} />
        <Tuile icone="cotes" titre="Descentes" texte="Pour préparer les quadriceps" onPress={() => aller({ page: "cotes", mode: "descente" })} />
      </Categorie>
      <Categorie titre="Courses">
        <Tuile icone="calendrier" titre="Mes courses"
               texte={suivante ? `${suivante.nom} : J-${joursAvant(suivante.date)}` : "Calendrier, budget, compte à rebours"}
               onPress={() => aller({ page: "courses" })} />
        <Tuile icone="course" titre="Préparer" texte="Profil, passages, prépa" onPress={() => aller({ page: "course" })} />
        <Tuile icone="nutrition" titre="Nutrition" texte="Glucides, eau, sel" onPress={() => aller({ page: "nutrition" })} />
      </Categorie>

      <Pressable onPress={() => aller({ page: "profil" })} accessibilityRole="button"
                 style={[S.ligne, { marginTop: 14, paddingVertical: 14 }]}>
        <Icone nom="plus" couleur={C.montee} />
        <View style={{ flex: 1 }}>
          <Text style={S.fort}>Ajouter une sortie</Text>
          <Text style={S.petit}>GPX de ta montre : points, côtes montées et chronos</Text>
        </View>
        <Icone nom="fleche" couleur={C.gris} taille={18} />
      </Pressable>

      <Section titre={`Près de ${lieu}`} action="Tout voir" onAction={() => aller({ page: "cotes", mode: "montee" })}>
        <View style={{ gap: 8 }}>
          {proches.length === 0 && <Text style={S.petit}>Aucune côte calculée près d'ici pour l'instant.</Text>}
          {proches.slice(0, 3).map((c, i) => (
            <Pressable key={c.id} onPress={() => ouvrirCote(c, i + 1)} accessibilityRole="button" style={S.ligne}>
              <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: couleurPente(c.pente_moy_pct) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {nombre(c.pente_moy_pct, 1)} %</Text>
                <Text style={S.petit} numberOfLines={1}>{c.adresse || c.nom || c.type_voie}</Text>
              </View>
              <Text style={S.fort}>{kmLisibles(c.distance_m)}</Text>
              <Icone nom="fleche" couleur={C.gris} taille={18} />
            </Pressable>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
