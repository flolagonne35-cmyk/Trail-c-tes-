// Pastille du coureur (initiale sur fond forêt, liseré orange) : dans la barre du haut et les
// classements, à la place du petit avatar dessiné. Le coureur en 3D est dans Mon monde.

import { Text, View } from "react-native";

import { C } from "../theme.ts";

export function Monogramme({ prenom, taille = 44 }: { prenom: string; taille?: number }) {
  const initiale = (prenom.trim()[0] ?? "T").toUpperCase();
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: C.foret, alignItems: "center", justifyContent: "center",
                   borderWidth: 2, borderColor: C.montee }}>
      <Text style={{ color: C.fond, fontWeight: "900", fontSize: taille * 0.42 }}>{initiale}</Text>
    </View>
  );
}
