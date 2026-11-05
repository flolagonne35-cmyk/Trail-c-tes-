// Convertisseur d'allure et prédiction de temps (Mon monde → Mes progrès).

import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { allureLisible, DISTANCES, lireAllure, lireTemps, riegel, tempsLisible, vitesseDe } from "../calcul/allures.ts";
import { C, S } from "../theme.ts";
import { nombre, Segments } from "./communs.tsx";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 50, fontSize: 18, color: C.encre,
                fontWeight: "700", textAlign: "center", width: 110 } as const;

export function Convertisseur() {
  const [allure, setAllure] = useState("5:00");
  const [record, setRecord] = useState("50:00");
  const [distance, setDistance] = useState("10");
  const a = lireAllure(allure);
  const ok = a > 2 && a < 20;
  const t = lireTemps(record);
  const d1 = DISTANCES.find(([, d]) => String(d) === distance)?.[1] ?? 10;
  return (
    <View style={[S.carte, { gap: 14 }]}>
      <Text style={S.h2}>Allure, vitesse et temps</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>Allure (min/km)</Text>
        <TextInput value={allure} onChangeText={setAllure} accessibilityLabel="Allure en minutes par kilomètre" style={champ} />
      </View>
      {ok ? (
        <View style={{ gap: 6 }}>
          <Text style={[S.fort, { fontSize: 17 }]}>= {nombre(vitesseDe(a), 1)} km/h</Text>
          <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
            {DISTANCES.map(([nom, d]) => `${nom} : ${tempsLisible(a * d)}`).join(" · ")}
          </Text>
          <Text style={S.petit}>Sur tapis, règle-le à {nombre(vitesseDe(a), 1)} km/h ; 1 % de pente compense l'absence de vent.</Text>
        </View>
      ) : <Text style={{ color: C.monteeFonce }}>Écris l'allure comme « 4:30 ».</Text>}

      <View style={{ height: 1, backgroundColor: C.aire }} />
      <Text style={S.fort}>Prédire un temps à partir d'un record</Text>
      <Segments options={DISTANCES.map(([nom, d]) => [String(d), nom] as [string, string])} valeur={distance} onChange={setDistance} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>Mon temps</Text>
        <TextInput value={record} onChangeText={setRecord} accessibilityLabel="Mon temps sur cette distance" style={champ} />
      </View>
      {Number.isFinite(t) && t > 0 ? (
        <View style={{ gap: 4 }}>
          {DISTANCES.filter(([, d]) => d !== d1).map(([nom, d]) => {
            const p = riegel(t, d1, d);
            return <Text key={nom} style={[S.petit, { fontSize: 15, color: C.encre }]}>{nom} : <Text style={S.fort}>{tempsLisible(p)}</Text> ({allureLisible(p / d)} /km)</Text>;
          })}
          <Text style={S.petit}>
            Formule de Riegel (1981) : juste à l'entraînement égal ; souvent optimiste au marathon si tu cours moins de 50 km par
            semaine, et pas faite pour le trail (le dénivelé compte à part).
          </Text>
        </View>
      ) : <Text style={{ color: C.monteeFonce }}>Écris le temps comme « 45:30 » ou « 1:45:00 ».</Text>}
    </View>
  );
}
