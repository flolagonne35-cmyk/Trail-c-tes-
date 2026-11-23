// Premier lancement : un grand paysage de crêtes au lever du soleil, une promesse claire, trois
// raisons d'y croire, et un seul bouton. Tout le reste (coureur, programme) vient ensuite.

import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { Icone } from "../composants/communs.tsx";
import { Paysage } from "../composants/Paysage.tsx";
import { C } from "../theme.ts";

const RAISONS: [Parameters<typeof Icone>[0]["nom"], string, string][] = [
  ["cotes", "Toutes les côtes de France", "Mesurées au mètre près avec les altitudes IGN, autour de chez toi."],
  ["programme", "Un programme taillé pour toi", "Ta course, ton niveau, tes jours : chaque séance te dit où aller."],
  ["courses", "Ta course, sans charge mentale", "Dates, trajet, logement, plan du jour J : tout au même endroit."],
];

export function EcranBienvenue({ onCreer, onPasser }: { onCreer: () => void; onPasser: () => void }) {
  const { height } = useWindowDimensions();
  const hero = Math.max(380, Math.min(560, height * 0.58));
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.encre }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ height: hero, justifyContent: "flex-end", paddingHorizontal: 28, paddingBottom: 36 }}>
        <Paysage hauteur={hero} />
        <Text style={{ position: "absolute", top: 28, left: 28, color: C.fond, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>
          Trail<Text style={{ color: C.montee }}>·</Text>côtes
        </Text>
        <View style={{ maxWidth: 520 }}>
          <Text style={{ color: C.fond, fontSize: 40, lineHeight: 44, fontWeight: "900", letterSpacing: -1 }} accessibilityRole="header">
            Chaque côte{"\n"}te rapproche{"\n"}de ta course.
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: C.fond, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24,
                     paddingHorizontal: 28, paddingTop: 32, paddingBottom: 36 }}>
        <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 22 }}>
          {RAISONS.map(([icone, titre, texte]) => (
            <View key={titre} style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.monteeClair, alignItems: "center", justifyContent: "center" }}>
                <Icone nom={icone} couleur={C.montee} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 17, fontWeight: "800", color: C.encre }}>{titre}</Text>
                <Text style={{ fontSize: 15, lineHeight: 22, color: C.gris }}>{texte}</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={onCreer} accessibilityRole="button"
                     style={({ pressed }) => ({ marginTop: 14, minHeight: 58, borderRadius: 18, alignItems: "center", justifyContent: "center",
                                                backgroundColor: C.montee, opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: C.blanc, fontSize: 17, fontWeight: "800" }}>Créer mon profil de coureur</Text>
          </Pressable>
          <Pressable onPress={onPasser} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: C.gris }}>Découvrir d'abord</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
