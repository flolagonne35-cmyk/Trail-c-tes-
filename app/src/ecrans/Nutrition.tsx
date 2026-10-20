// Écran « Nutrition et ravitos » : objectif, ravitaillements, débits horaires ajustables, plan par tronçon.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { construirePlan, heuresLisibles, lireObjectif, type Preferences, type Ravito } from "../calcul/nutrition.ts";
import type { Parcours } from "../calcul/profil.ts";
import { Ajusteur, EnTete, nombre } from "../composants/communs.tsx";
import { partagerTexte } from "../fichiers.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontSize: 15,
                color: C.encre } as const;

export function EcranNutrition({ parcours, objectif, setObjectif, ravitos, setRavitos, prefs, setPrefs }: {
  parcours: Parcours; objectif: string; setObjectif: (v: string) => void;
  ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void; prefs: Preferences; setPrefs: (p: Preferences) => void;
}) {
  const [km, setKm] = useState("");
  const [nom, setNom] = useState("");
  const heures = lireObjectif(objectif);
  const plan = useMemo(
    () => (Number.isFinite(heures) && heures > 0 ? construirePlan(parcours, heures, ravitos, prefs) : []),
    [parcours, heures, ravitos, prefs],
  );

  function ajouterRavito() {
    const k = parseFloat(km.replace(",", "."));
    if (!Number.isFinite(k) || k <= 0 || k >= parcours.distance_km) return;
    setRavitos([...ravitos, { km: k, nom: nom.trim() || `km ${nombre(k, 1)}` }].sort((a, b) => a.km - b.km));
    setKm("");
    setNom("");
  }

  function texteDuPlan() {
    return [`Plan nutrition — ${parcours.nom} (objectif ${heuresLisibles(heures)})`,
      ...plan.map((t) => `${t.de} → ${t.a} (km ${nombre(t.km_debut, 1)}–${nombre(t.km_fin, 1)}, passage ${t.passage}) : ${t.resume.join(", ")}`),
    ].join("\n");
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <EnTete surtitre="Plan de course" titre="Nutrition et ravitos"
              sousTitre={`${parcours.nom} · objectif ${Number.isFinite(heures) ? heuresLisibles(heures) : "?"}`} />

      <View style={[S.carte, { gap: 12 }]}>
        <Text style={S.surtitre}>Objectif de temps</Text>
        <TextInput value={objectif} onChangeText={setObjectif} placeholder="ex. 38h ou 5h40"
                   style={[champ, { backgroundColor: C.fond }]}
                   accessibilityLabel="Objectif de temps" autoCapitalize="none" />
        {!Number.isFinite(heures) && <Text style={{ color: C.monteeFonce }}>Format attendu : 38h, 5h40 ou 90min.</Text>}
        <Text style={S.surtitre}>Par heure de course</Text>
        <Ajusteur etiquette="Glucides" valeur={prefs.glucides} unite="g" pas={5} max={150}
                  onChange={(v) => setPrefs({ ...prefs, glucides: v })} />
        <Ajusteur etiquette="Eau" valeur={prefs.eau} unite="ml" pas={50} max={1500}
                  onChange={(v) => setPrefs({ ...prefs, eau: v })} />
        <Ajusteur etiquette="Sodium" valeur={prefs.sodium} unite="mg" pas={50} max={2000}
                  onChange={(v) => setPrefs({ ...prefs, sodium: v })} />
        <Ajusteur etiquette="Température" valeur={prefs.temperature} unite="°C" pas={1} min={-10} max={45}
                  onChange={(v) => setPrefs({ ...prefs, temperature: v })} />
        <Text style={S.petit}>Eau et sodium +10 % par tranche de 5 °C au-dessus de 15 °C. Temps de passage selon la pente
          (coût énergétique de la course, Minetti 2002), recalés sur l'objectif.</Text>
      </View>

      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.surtitre}>Ravitaillements</Text>
        {ravitos.map((r, i) => (
          <View key={`${r.km}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[S.fort, { flex: 1 }]}>km {nombre(r.km, 1)} · {r.nom}</Text>
            <Pressable onPress={() => setRavitos(ravitos.filter((_, k) => k !== i))} accessibilityRole="button"
                       accessibilityLabel={`Supprimer le ravitaillement ${r.nom}`}
                       style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20, color: C.gris }}>×</Text>
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={km} onChangeText={setKm} placeholder="km" keyboardType="decimal-pad"
                     style={[champ, { width: 64, backgroundColor: C.fond }]} accessibilityLabel="Kilomètre du ravitaillement" />
          <TextInput value={nom} onChangeText={setNom} placeholder="Nom" onSubmitEditing={ajouterRavito}
                     style={[champ, { flex: 1, minWidth: 0, backgroundColor: C.fond }]} accessibilityLabel="Nom du ravitaillement" />
          <Pressable onPress={ajouterRavito} accessibilityRole="button"
                     style={[S.bouton, { minHeight: 44, paddingHorizontal: 12 }]}>
            <Text style={S.boutonTexte}>Ajouter</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
        <Text style={S.h2} accessibilityRole="header">Entre les ravitaillements</Text>
        <Text style={{ fontSize: 13, color: C.gris }}>{plan.length} tronçon{plan.length > 1 ? "s" : ""}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {plan.map((t) => (
          <View key={t.n} style={{ backgroundColor: C.blanc, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <Text style={[S.fort, { flex: 1 }]}>{t.de} → {t.a}</Text>
              <Text style={S.petit}>km {nombre(t.km_debut, 1)} – {nombre(t.km_fin, 1)}</Text>
            </View>
            <Text style={[S.petit, { marginTop: 2 }]}>Passage estimé à {t.passage} · D+ {nombre(t.dplus_m)} m</Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {t.resume.map((r) => (
                <Text key={r} style={{ fontSize: 12, fontWeight: "600", paddingVertical: 5, paddingHorizontal: 10,
                                       borderRadius: 999, overflow: "hidden", backgroundColor: C.sable, color: C.encre }}>{r}</Text>
              ))}
            </View>
          </View>
        ))}
      </View>
      {plan.length > 0 && (
        <Pressable onPress={() => partagerTexte("Plan nutrition", texteDuPlan())} accessibilityRole="button"
                   style={[S.bouton, { marginTop: 14 }]}>
          <Text style={S.boutonTexte}>Partager le plan</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
