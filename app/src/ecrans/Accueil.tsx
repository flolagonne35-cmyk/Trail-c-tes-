// Onglet « Accueil » : mon coureur et mes points, les trois actions principales, les côtes proches.

import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar } from "../avatar/Avatar.tsx";
import { kmLisibles, type CoteProche } from "../calcul/cotes.ts";
import { score } from "../calcul/points.ts";
import { Icone, nombre, Section, type Onglet } from "../composants/communs.tsx";
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

function Action({ icone, titre, texte, onPress, fonce }: {
  icone: Parameters<typeof Icone>[0]["nom"]; titre: string; texte: string; onPress: () => void; fonce?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titre}. ${texte}`}
               style={{ flex: 1, minWidth: 0, borderRadius: 18, padding: 16, gap: 10, backgroundColor: fonce ? C.encre : C.blanc }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
                     backgroundColor: fonce ? "#FFFFFF1F" : C.monteeClair }}>
        <Icone nom={icone} couleur={fonce ? C.blanc : C.monteeFonce} />
      </View>
      <View>
        <Text style={{ fontSize: 17, fontWeight: "700", color: fonce ? C.blanc : C.encre }}>{titre}</Text>
        <Text style={{ fontSize: 13, marginTop: 2, color: fonce ? "#FFFFFFB3" : C.gris }}>{texte}</Text>
      </View>
    </Pressable>
  );
}

export function EcranAccueil({ profil, proches, lieu, nbCotes, allerA, ouvrirCote }: {
  profil: Profil; proches: CoteProche[]; lieu: string; nbCotes: number;
  allerA: (o: Onglet) => void; ouvrirCote: (c: CoteProche, rang: number) => void;
}) {
  const { valides } = score(profil.activites);
  const s = semaine(profil);
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Pressable onPress={() => allerA("profil")} accessibilityRole="button" accessibilityLabel="Mon profil"
                 style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
        <View style={{ borderRadius: 30, overflow: "hidden" }}><Avatar a={profil.apparence} taille={60} cadrage="buste" /></View>
        <View style={{ flex: 1 }}>
          <Text style={S.surtitre}>Trail-côtes</Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: C.encre }}>Salut {profil.prenom}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.blanc, borderRadius: 999,
                       paddingVertical: 8, paddingHorizontal: 12 }}>
          <Icone nom="trophee" couleur={C.montee} taille={18} />
          <Text style={S.fort}>{nombre(valides)} pts</Text>
        </View>
      </Pressable>

      <View style={{ gap: 10, marginTop: 20 }}>
        <Action fonce icone="cotes" titre="Trouver une côte" onPress={() => allerA("cotes")}
                texte={`${nbCotes} côtes mesurées au mètre près, autour de toi ou d'une ville`} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Action icone="course" titre="Préparer une course" texte="Profil, passages, nutrition" onPress={() => allerA("course")} />
          <Action icone="plus" titre="Ajouter une sortie" texte="Gagne des points" onPress={() => allerA("profil")} />
        </View>
      </View>

      <Section titre={`Près de ${lieu}`} action="Tout voir" onAction={() => allerA("cotes")}>
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

      <Section titre="Ma semaine">
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[["Distance", `${nombre(s.km, 1)} km`], ["Dénivelé", `${nombre(s.dplus)} m`], ["Points", nombre(s.points)]].map(([t, v]) => (
            <View key={t} style={{ flex: 1, backgroundColor: C.blanc, borderRadius: 14, padding: 12 }}>
              <Text style={S.petit}>{t}</Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: C.encre, marginTop: 2 }}>{v}</Text>
            </View>
          ))}
        </View>
        {s.sorties === 0 && <Text style={S.petit}>Ajoute le GPX de ta prochaine sortie pour la voir ici.</Text>}
      </Section>
    </ScrollView>
  );
}
