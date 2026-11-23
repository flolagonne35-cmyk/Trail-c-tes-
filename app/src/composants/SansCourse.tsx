// Quand aucune course n'est choisie (Programme → Mon plan, Courses → Jour J) : une seule porte
// d'entrée, la recherche de Courses. Pour qui n'a pas de course précise, un objectif libre
// (« trail 30 km 1500 m »), et pour le jour J, le GPX de la course.

import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { dateValide } from "../calcul/calendrier.ts";
import { lireFormat, type CourseCible } from "../calcul/plan.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 14, paddingHorizontal: 16, minHeight: 52, fontSize: 16, color: C.encre } as const;

export function SansCourse({ titre, texte, onTrouver, onObjectif, onImporter, onExemple, etatImport }: {
  titre: string; texte: string; onTrouver: () => void; onObjectif: (c: CourseCible) => void;
  onImporter?: () => void; onExemple?: () => void; etatImport?: React.ReactNode;
}) {
  const [format, setFormat] = useState("");
  const [date, setDate] = useState("");
  const lu = lireFormat(format);
  return (
    <View style={{ gap: 28, paddingTop: 12 }}>
      <View style={{ gap: 10 }}>
        <Text style={S.titre} accessibilityRole="header">{titre}</Text>
        <Text style={S.sousTitre}>{texte}</Text>
      </View>
      <Pressable onPress={onTrouver} accessibilityRole="button"
                 style={({ pressed }) => ({ minHeight: 58, borderRadius: 18, backgroundColor: C.montee, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ color: C.blanc, fontSize: 17, fontWeight: "800" }}>Trouver ma course</Text>
      </Pressable>

      <View style={[S.carte, { marginTop: 0, gap: 14 }]}>
        <Text style={S.fort}>Pas de course précise ?</Text>
        <Text style={S.petit}>Écris le format visé, par exemple « 10 km », « semi », « trail 30 km 1500 m ».</Text>
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

      {onImporter && (
        <View style={{ gap: 10 }}>
          <Pressable onPress={onImporter} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>J'ai le GPX de ma course</Text>
          </Pressable>
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
