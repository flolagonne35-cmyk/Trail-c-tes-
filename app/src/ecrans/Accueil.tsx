// Onglet « Accueil » : mon coureur, mes points et ma semaine. Les rubriques de l'appli sont dans les
// onglets du bas et le menu ☰ : l'accueil ne les répète pas.

import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Avatar } from "../avatar/Avatar.tsx";
import { score } from "../calcul/points.ts";
import { nombre } from "../composants/communs.tsx";
import type { Destination } from "../composants/Menu.tsx";
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

export function EcranAccueil({ profil, aller }: { profil: Profil; aller: (d: Destination) => void }) {
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Bandeau profil={profil} onPress={() => aller({ page: "profil" })} />
    </ScrollView>
  );
}
