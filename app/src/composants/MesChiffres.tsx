// « Mes chiffres à moi » (nutrition) : test de pesée guidé et profil de sel. Les besoins en eau et en
// sel varient du simple au triple d'un coureur à l'autre : on les mesure plutôt que de deviner.

import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import {
  besoinsPersonnels, partPerdue, profilSel, QUESTIONS_SEL, SEL, tauxSudation, testPourTemperature, type TestSudation,
} from "../calcul/sudation.ts";
import { chargerChiffres, CHIFFRES_VIDES, enregistrerChiffres, type MesChiffres as Chiffres } from "../mesChiffres.ts";
import { C, S } from "../theme.ts";
import { nombre, Segments } from "./communs.tsx";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 17, color: C.encre,
                fontWeight: "700", textAlign: "center" } as const;
const lire = (t: string) => parseFloat(t.replace(",", "."));

function Champ({ etiquette, valeur, onChange, unite }: { etiquette: string; valeur: string; onChange: (v: string) => void; unite: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{etiquette}</Text>
      <TextInput value={valeur} onChangeText={onChange} keyboardType="decimal-pad" accessibilityLabel={etiquette}
                 style={[champ, { width: 92 }]} />
      <Text style={[S.petit, { width: 30 }]}>{unite}</Text>
    </View>
  );
}

export function MesChiffres({ temperature, onUtiliser }: { temperature: number; onUtiliser: (eau: number, sodium: number) => void }) {
  const [chiffres, setChiffresEtat] = useState<Chiffres>(CHIFFRES_VIDES);
  useEffect(() => { chargerChiffres().then(setChiffresEtat); }, []);
  // on relit le stockage avant d'écrire : le sac à produits y range aussi ses choix
  const setChiffres = (c: Chiffres) => {
    setChiffresEtat(c);
    chargerChiffres().then((f) => enregistrerChiffres({ ...f, tests: c.tests, sel: c.sel }));
  };
  const [etape, setEtape] = useState<"resume" | "pesee" | "sel">("resume");
  const [avant, setAvant] = useState("");
  const [apres, setApres] = useState("");
  const [bu, setBu] = useState("0");
  const [duree, setDuree] = useState("1");
  const [temp, setTemp] = useState(String(temperature));
  const [reponses, setReponses] = useState<boolean[]>([false, false, false]);

  const essai = { dureeH: lire(duree), avantKg: lire(avant), apresKg: lire(apres), buL: lire(bu) };
  const taux = tauxSudation(essai);
  const test = testPourTemperature(chiffres.tests, temperature);
  const lh = test ? tauxSudation(test) : null;
  const besoins = lh && chiffres.sel ? besoinsPersonnels(lh, chiffres.sel) : lh ? besoinsPersonnels(lh, "moyen") : null;

  if (etape === "pesee") {
    return (
      <View style={[S.carte, { gap: 12 }]}>
        <Text style={S.h2}>Test de pesée</Text>
        <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
          Pendant une sortie d'environ 1 h à ton allure habituelle : pèse-toi nu juste avant, puis juste après (sèche-toi).
          Note ce que tu as bu. Refais-le un jour chaud et un jour frais : l'appli prendra le plus proche de la météo de ta course.
        </Text>
        <Champ etiquette="Poids avant" valeur={avant} onChange={setAvant} unite="kg" />
        <Champ etiquette="Poids après" valeur={apres} onChange={setApres} unite="kg" />
        <Champ etiquette="Boisson bue" valeur={bu} onChange={setBu} unite="L" />
        <Champ etiquette="Durée de la sortie" valeur={duree} onChange={setDuree} unite="h" />
        <Champ etiquette="Température" valeur={temp} onChange={setTemp} unite="°C" />
        {avant && apres ? (
          taux ? (
            <Text style={[S.fort, { color: C.descenteFonce }]}>
              Tu perds ≈ {nombre(taux, 1)} L de sueur par heure ({nombre(partPerdue(essai) * 100, 1)} % de ton poids pendant le test
              {partPerdue(essai) > 0.02 ? " : au-delà de 2 %, la performance baisse, bois davantage" : ""}).
            </Text>
          ) : <Text style={{ color: C.monteeFonce, fontWeight: "600" }}>Ces chiffres ne collent pas : vérifie les pesées et la durée.</Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => setEtape("resume")} accessibilityRole="button" style={[S.boutonClair, { flex: 1 }]}>
            <Text style={S.boutonClairTexte}>Annuler</Text>
          </Pressable>
          <Pressable disabled={!taux} accessibilityRole="button" style={[S.bouton, { flex: 1, opacity: taux ? 1 : 0.45 }]}
                     onPress={() => {
                       const t: TestSudation = { ...essai, date: new Date().toISOString().slice(0, 10), temperature: lire(temp) || temperature };
                       setChiffres({ ...chiffres, tests: [...chiffres.tests, t] });
                       setEtape("resume");
                     }}>
            <Text style={S.boutonTexte}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (etape === "sel") {
    return (
      <View style={[S.carte, { gap: 12 }]}>
        <Text style={S.h2}>Ta sueur est-elle salée ?</Text>
        {QUESTIONS_SEL.map((q, i) => (
          <View key={q} style={{ gap: 6 }}>
            <Text style={[S.fort, { fontWeight: "600" }]}>{q}</Text>
            <Segments options={[["non", "Non"], ["oui", "Oui"]]} valeur={reponses[i] ? "oui" : "non"}
                      onChange={(v) => setReponses(reponses.map((r, k) => (k === i ? v === "oui" : r)))} />
          </View>
        ))}
        <Text style={S.petit}>{SEL[profilSel(reponses.filter(Boolean).length)].nom} : {SEL[profilSel(reponses.filter(Boolean).length)].detail}</Text>
        <Pressable onPress={() => { setChiffres({ ...chiffres, sel: profilSel(reponses.filter(Boolean).length) }); setEtape("resume"); }}
                   accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>Enregistrer</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[S.carte, { gap: 12 }]}>
      <Text style={S.h2}>Mes chiffres à moi</Text>
      <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
        Selon les coureurs, la sueur va de 0,5 à plus de 2 L par heure, et de peu à très salée. Deux minutes de test remplacent la
        moyenne par tes vrais besoins. Tout reste sur ton téléphone.
      </Text>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>💧 Sueur : {lh ? `${nombre(lh, 1)} L/h (test à ${test!.temperature} °C, le ${new Date(test!.date).toLocaleDateString("fr-FR")})` : "pas encore mesurée"}</Text>
        <Text style={S.fort}>🧂 Sel : {chiffres.sel ? SEL[chiffres.sel].nom.toLowerCase() : "pas encore renseigné"}</Text>
      </View>
      {besoins && (
        <Pressable onPress={() => onUtiliser(besoins.eau, besoins.sodium)} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>Utiliser mes chiffres : {besoins.eau} ml d'eau, {besoins.sodium} mg de sodium par heure</Text>
        </Pressable>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={() => setEtape("pesee")} accessibilityRole="button" style={[S.boutonClair, { flex: 1 }]}>
          <Text style={S.boutonClairTexte}>{chiffres.tests.length ? "Nouveau test de pesée" : "Faire le test de pesée"}</Text>
        </Pressable>
        <Pressable onPress={() => setEtape("sel")} accessibilityRole="button" style={[S.boutonClair, { flex: 1 }]}>
          <Text style={S.boutonClairTexte}>{chiffres.sel ? "Refaire le test du sel" : "Ma sueur est-elle salée ?"}</Text>
        </Pressable>
      </View>
      <Text style={S.petit}>
        Méthode de l'ACSM (Sawka, 2007) : on boit environ 70 % de ce qu'on perd, jamais plus qu'on ne sue. Sel : Baker (2017), ISSN.
        Ce ne sont pas des conseils médicaux.
      </Text>
    </View>
  );
}
