// Premier lancement : ce que fait l'appli, puis création du coureur (tout est facultatif).

import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar } from "../avatar/Avatar.tsx";
import type { Apparence } from "../avatar/modele.ts";
import { Icone } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";

const POINTS: [Parameters<typeof Icone>[0]["nom"], string, string][] = [
  ["cotes", "Des côtes près de chez toi", "Longueur, pente tous les 50 m et adresse du pied, mesurées sur les altitudes IGN."],
  ["course", "Ta course préparée", "Importe le GPX : profil découpé, temps de passage et plan de nutrition."],
  ["trophee", "Des points à chaque sortie", "Kilomètres, dénivelé et montées de côtes, comptés dès la création du compte."],
];

export function EcranBienvenue({ apparence, onCreer, onPasser }: { apparence: Apparence; onCreer: () => void; onPasser: () => void }) {
  return (
    <ScrollView style={S.ecran} contentContainerStyle={[S.contenu, { paddingTop: 16, paddingBottom: 32 }]}>
      <View style={{ alignItems: "center" }}>
        <Avatar a={apparence} taille={190} />
        <Text style={[S.titre, { fontSize: 34, lineHeight: 38, marginTop: 16, textAlign: "center" }]}>Trail-côtes</Text>
        <Text style={[S.sousTitre, { textAlign: "center", fontSize: 16 }]}>Les côtes, les parcours et l'effort, au mètre près.</Text>
      </View>
      <View style={{ gap: 10, marginTop: 24 }}>
        {POINTS.map(([icone, titre, texte]) => (
          <View key={titre} style={[S.ligne, { alignItems: "flex-start", padding: 14 }]}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.monteeClair, alignItems: "center", justifyContent: "center" }}>
              <Icone nom={icone} couleur={C.monteeFonce} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>{titre}</Text>
              <Text style={[S.petit, { fontSize: 13, marginTop: 2 }]}>{texte}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={onCreer} accessibilityRole="button" style={[S.bouton, { marginTop: 24, minHeight: 54 }]}>
        <Text style={[S.boutonTexte, { fontSize: 16 }]}>Créer mon coureur</Text>
      </Pressable>
      <Pressable onPress={onPasser} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: C.gris }}>Plus tard</Text>
      </Pressable>
    </ScrollView>
  );
}
