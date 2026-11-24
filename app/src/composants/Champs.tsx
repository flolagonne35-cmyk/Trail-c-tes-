// Champs de saisie libres (retour du 24/11 : « la distance, tu pourrais la choisir toi-même, mettre
// ton chiffre ») : un nombre avec son unité, une date avec le calendrier du téléphone ou de l'ordinateur.

import { createElement } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { C, S } from "../theme.ts";

const champ = { minHeight: 48, borderRadius: 12, backgroundColor: C.fond, paddingHorizontal: 12, fontSize: 16, color: C.encre, fontWeight: "700" as const };

/** Un nombre libre (vide = pas de limite), avec son unité à droite. */
export function ChampNombre({ valeur, onChange, unite, etiquette, indice = "—" }: {
  valeur: number | undefined; onChange: (v: number | undefined) => void; unite: string; etiquette: string; indice?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TextInput value={valeur === undefined ? "" : String(valeur).replace(".", ",")} placeholder={indice} placeholderTextColor={C.gris}
                 onChangeText={(t) => {
                   const v = parseFloat(t.replace(",", ".").replace(/[^\d.]/g, ""));
                   onChange(Number.isFinite(v) ? v : undefined);
                 }}
                 keyboardType="decimal-pad" accessibilityLabel={etiquette} style={[champ, { flex: 1, minWidth: 0, textAlign: "center" }]} />
      <Text style={[S.petit, { color: C.encre }]}>{unite}</Text>
    </View>
  );
}

/** Une date « AAAA-MM-JJ » (vide = pas de limite) : calendrier natif sur le web, saisie JJ/MM/AAAA sur le téléphone. */
export function ChampDate({ valeur, onChange, etiquette, min }: {
  valeur: string; onChange: (v: string) => void; etiquette: string; min?: string;
}) {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date", value: valeur, min, "aria-label": etiquette,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { flex: 1, minWidth: 0, height: 48, borderRadius: 12, border: "none", background: C.fond, padding: "0 12px",
               fontSize: 16, fontWeight: 700, color: C.encre, fontFamily: "inherit" },
    });
  }
  const [a, m, j] = valeur ? valeur.split("-") : ["", "", ""];
  return (
    <TextInput value={valeur ? `${j}/${m}/${a}` : undefined} placeholder="JJ/MM/AAAA" placeholderTextColor={C.gris}
               onChangeText={(t) => {
                 const x = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                 if (x) onChange(`${x[3]}-${x[2].padStart(2, "0")}-${x[1].padStart(2, "0")}`);
                 else if (!t) onChange("");
               }}
               keyboardType="numbers-and-punctuation" accessibilityLabel={etiquette} style={[champ, { flex: 1, minWidth: 0 }]} />
  );
}

/** Raccourcis sous un champ : « Moins de 15 km », « 3 prochains mois »… */
export function Raccourcis<T>({ options, actif, onChoisir }: { options: [string, T][]; actif?: string; onChoisir: (v: T, nom: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([nom, v]) => {
        const sel = nom === actif;
        return (
          <Pressable key={nom} onPress={() => onChoisir(v, nom)} accessibilityRole="button" aria-selected={sel}
                     style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                              backgroundColor: sel ? C.encre : C.blanc, borderWidth: 1, borderColor: sel ? C.encre : C.sable }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: sel ? C.fond : C.encre }}>{nom}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
