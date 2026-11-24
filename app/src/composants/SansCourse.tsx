// Ma course : l'objectif libre (en bas de « Trouver ») et l'écran « pas encore de course » de
// Mon plan et du Jour J, qui renvoie vers « Trouver », le seul endroit où l'on choisit sa course.

import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { dateValide } from "../calcul/calendrier.ts";
import { lireFormat, type CourseCible } from "../calcul/plan.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 14, paddingHorizontal: 16, minHeight: 52, fontSize: 16, color: C.encre } as const;

/** Objectif sans course précise (« trail 30 km 1500 m », une date) : en bas de « Trouver ». */
export function ObjectifLibre({ onObjectif }: { onObjectif: (c: CourseCible) => void }) {
  const [format, setFormat] = useState("");
  const [date, setDate] = useState("");
  const lu = lireFormat(format);
  return (
    <View style={[S.carte, { gap: 14 }]}>
      <Text style={S.fort}>Pas de course précise ?</Text>
      <Text style={S.petit}>Écris le format visé, par exemple « 10 km », « semi », « trail 30 km 1500 m » : ton plan se construit dessus.</Text>
      <TextInput value={format} onChangeText={setFormat} placeholder="trail 30 km 1500 m" autoCorrect={false}
                 accessibilityLabel="Format visé" style={champ} />
      <TextInput value={date} onChangeText={setDate} placeholder="Date (AAAA-MM-JJ), facultatif" autoCorrect={false}
                 accessibilityLabel="Date visée" style={champ} />
      {format !== "" && !lu && <Text style={{ color: C.monteeFonce }}>Indique au moins la distance, par exemple « 21 km ».</Text>}
      <Pressable disabled={!lu} accessibilityRole="button" style={[S.bouton, { opacity: lu ? 1 : 0.4 }]}
                 onPress={() => lu && onObjectif({ nom: `Objectif ${format.trim()}`, ...lu, date: dateValide(date) ? date : undefined })}>
        <Text style={S.boutonTexte}>Valider cet objectif</Text>
      </Pressable>
    </View>
  );
}

/**
 * Plan ou jour J sans course choisie : une phrase et un bouton vers « Trouver », rien d'autre
 * (le choix de la course ne se fait qu'à un seul endroit).
 */
export function SansCourse({ titre, texte, onTrouver, onImporter, onExemple, etatImport, onCapture }: {
  titre: string; texte: string; onTrouver: () => void;
  onImporter?: () => void; onExemple?: () => void; etatImport?: React.ReactNode;
  /** capture d'écran du profil de la course, lue par l'IA (quand on n'a pas le GPX) */
  onCapture?: () => void;
}) {
  return (
    <View style={{ gap: 24, paddingTop: 20 }}>
      <View style={{ gap: 10 }}>
        <Text style={S.titre} accessibilityRole="header">{titre}</Text>
        <Text style={S.sousTitre}>{texte}</Text>
      </View>
      <Pressable onPress={onTrouver} accessibilityRole="button"
                 style={({ pressed }) => ({ minHeight: 58, borderRadius: 18, backgroundColor: C.montee, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ color: C.blanc, fontSize: 17, fontWeight: "800" }}>Choisir ma course</Text>
      </Pressable>
      {onImporter && (
        <View style={{ gap: 10 }}>
          <Pressable onPress={onImporter} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>J'ai le GPX de ma course</Text>
          </Pressable>
          {onCapture && (
            <Pressable onPress={onCapture} accessibilityRole="button" style={S.boutonClair}>
              <Text style={S.boutonClairTexte}>J'ai une capture d'écran du profil</Text>
            </Pressable>
          )}
          {onExemple && (
            <Pressable onPress={onExemple} accessibilityRole="button" hitSlop={8} style={{ alignItems: "center", minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: C.gris, fontWeight: "700", fontSize: 15 }}>Voir avec un exemple (montée de l'Alpe d'Huez)</Text>
            </Pressable>
          )}
          {etatImport}
        </View>
      )}
    </View>
  );
}
