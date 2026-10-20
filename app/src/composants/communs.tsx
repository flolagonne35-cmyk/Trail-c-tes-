// Briques d'interface communes aux écrans : en-tête, tuiles de chiffres, puces, ajusteur, navigation.

import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { C, S } from "../theme.ts";

export function EnTete({ surtitre, titre, sousTitre, retour }: {
  surtitre: string; titre: string; sousTitre?: string; retour?: () => void;
}) {
  return (
    <View style={{ paddingTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8 }}>
        {retour && (
          <Pressable onPress={retour} accessibilityRole="button" accessibilityLabel="Retour"
                     style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable,
                              alignItems: "center", justifyContent: "center" }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.encre} strokeWidth={2}
                 strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
          </Pressable>
        )}
        <Text style={S.surtitre}>{surtitre}</Text>
      </View>
      <Text style={S.titre} accessibilityRole="header">{titre}</Text>
      {sousTitre ? <Text style={S.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

export function Tuiles({ valeurs }: { valeurs: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
      {valeurs.map(([etiquette, valeur]) => (
        <View key={etiquette} style={{ flex: 1, backgroundColor: C.sable, borderRadius: 12, paddingVertical: 10,
                                       paddingHorizontal: 12 }}>
          <Text style={S.petit}>{etiquette}</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: C.encre, marginTop: 2 }}>{valeur}</Text>
        </View>
      ))}
    </View>
  );
}

export function Puce({ texte, actif, onPress }: { texte: string; actif?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? "button" : "text"}
               accessibilityState={onPress ? { selected: !!actif } : undefined}
               style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, minHeight: 36,
                        justifyContent: "center", backgroundColor: actif ? C.encre : C.sable }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: actif ? C.fond : C.encre }}>{texte}</Text>
    </Pressable>
  );
}

export function Ajusteur({ etiquette, valeur, unite, pas, min = 0, max = 10000, onChange }: {
  etiquette: string; valeur: number; unite: string; pas: number; min?: number; max?: number;
  onChange: (v: number) => void;
}) {
  const bouton = (signe: -1 | 1) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${signe < 0 ? "Moins" : "Plus"} ${pas} ${unite}, ${etiquette}`}
               onPress={() => onChange(Math.min(max, Math.max(min, valeur + signe * pas)))}
               style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable, alignItems: "center",
                        justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: C.encre }}>{signe < 0 ? "−" : "+"}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{etiquette}</Text>
      {bouton(-1)}
      <Text style={{ fontSize: 16, fontWeight: "700", color: C.encre, minWidth: 76, textAlign: "center" }}>
        {valeur} {unite}
      </Text>
      {bouton(1)}
    </View>
  );
}

export type Onglet = "parcours" | "nutrition" | "cotes";

const ICONES: Record<Onglet, ReactNode> = {
  parcours: <Path d="M3 18l6-9 4 5 3-4 5 8z" />,
  nutrition: <Path d="M7 3v8a3 3 0 0 0 6 0V3M10 11v10M17 3c-2 2-3 5-3 8h3v10" />,
  cotes: <><Path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" /><Circle cx={12} cy={11} r={2} /></>,
};
const NOMS: Record<Onglet, string> = { parcours: "Parcours", nutrition: "Nutrition", cotes: "Côtes" };

export function Navigation({ actif, onChange, basSur }: { actif: Onglet; onChange: (o: Onglet) => void; basSur: number }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: C.blanc, paddingTop: 8,
                                               paddingHorizontal: 12, paddingBottom: Math.max(16, basSur) }}>
      {(Object.keys(NOMS) as Onglet[]).map((o) => {
        const couleur = o === actif ? C.encre : C.gris;
        return (
          <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="tab" accessibilityState={{ selected: o === actif }}
                     style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, minHeight: 44 }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={2}
                 strokeLinecap="round" strokeLinejoin="round">{ICONES[o]}</Svg>
            <Text style={{ fontSize: 12, color: couleur, fontWeight: o === actif ? "700" : "400" }}>{NOMS[o]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const nombre = (v: number, decimales = 0) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
