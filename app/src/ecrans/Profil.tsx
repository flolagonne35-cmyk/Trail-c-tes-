// Onglet « Profil » : mon coureur, mes points, ajouter une sortie, mes sorties, classement, barème.

import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Avatar } from "../avatar/Avatar.tsx";
import type { Cote } from "../calcul/cotes.ts";
import { activiteDepuisGpx, activiteDepuisPhoto, BAREME, score, type Activite } from "../calcul/points.ts";
import { Icone, nombre, Section, Tuiles } from "../composants/communs.tsx";
import { choisirGpx } from "../fichiers.ts";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 15,
                color: C.encre } as const;

const STATUT: Record<Activite["statut"], [string, string, string]> = {
  validee: ["Validée", C.platClair, C.platFonce],
  en_attente: ["En attente", C.descenteClair, C.descenteFonce],
  refusee: ["Refusée", C.monteeClair, C.monteeFonce],
};

export function EcranProfil({ profil, setProfil, cotes, onPersonnaliser }: {
  profil: Profil; setProfil: (p: Profil) => void; cotes: Cote[]; onPersonnaliser: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saisie, setSaisie] = useState({ date: new Date().toISOString().slice(0, 10), km: "", dplus: "" });
  const { valides, enAttente } = score(profil.activites);
  const validees = profil.activites.filter((a) => a.statut === "validee");

  const ajouter = (a: Activite) => {
    setProfil({ ...profil, activites: [a, ...profil.activites] });
    setMessage(a.statut === "refusee" ? `Sortie refusée : ${a.motif}`
      : a.statut === "en_attente" ? `${a.points} points en attente de validation.`
      : `+${a.points} points${a.repetitions.length ? `, dont ${a.repetitions.reduce((s, r) => s + r.n, 0)} montées de côtes` : ""}.`);
  };
  async function ajouterGpx() {
    setMessage(null);
    try {
      const f = await choisirGpx();
      if (f) ajouter(activiteDepuisGpx(f.texte, cotes, profil.creeLe, profil.activites.map((a) => a.empreinte)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  async function choisirPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled && r.assets?.length) setPhoto(r.assets[0].uri);
  }
  function envoyerPhoto() {
    const km = parseFloat(saisie.km.replace(",", "."));
    const dplus = parseFloat(saisie.dplus.replace(",", ".") || "0");
    if (!photo || !Number.isFinite(km) || km <= 0 || !Number.isFinite(dplus) || !/^\d{4}-\d{2}-\d{2}$/.test(saisie.date)) {
      setMessage("Il faut la capture, la date (AAAA-MM-JJ), la distance et le D+.");
      return;
    }
    ajouter(activiteDepuisPhoto({ date: `${saisie.date}T12:00:00Z`, distance_km: km, dplus_m: dplus, photo }, profil.creeLe));
    setPhoto(null);
    setSaisie({ ...saisie, km: "", dplus: "" });
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center", marginTop: 12 }}>
        <Avatar a={profil.apparence} taille={150} />
        <Text style={[S.titre, { marginTop: 10 }]}>{profil.prenom}</Text>
        <Text style={S.petit}>Points comptés depuis le {new Date(profil.creeLe).toLocaleDateString("fr-FR")}</Text>
        <Pressable onPress={onPersonnaliser} accessibilityRole="button" style={[S.boutonClair, { marginTop: 12, minHeight: 44, alignSelf: "stretch" }]}>
          <Text style={S.boutonClairTexte}>Personnaliser mon coureur</Text>
        </Pressable>
      </View>
      <Tuiles valeurs={[["Points", nombre(valides)], ["En attente", nombre(enAttente)], ["Sorties", nombre(validees.length)]]} />

      <Section titre="Ajouter une sortie">
        <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
          <Pressable onPress={ajouterGpx} accessibilityRole="button" style={[S.bouton, { flexDirection: "row", gap: 8 }]}>
            <Icone nom="gpx" couleur={C.fond} /><Text style={S.boutonTexte}>Fichier GPX</Text>
          </Pressable>
          <Text style={S.petit}>Validé tout de suite. Garmin Connect et Strava exportent le GPX d'une sortie ; les montées des
            côtes de l'appli sont comptées automatiquement.</Text>
          <Pressable onPress={choisirPhoto} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>{photo ? "Capture choisie — changer" : "Capture d'écran Strava / Garmin"}</Text>
          </Pressable>
          {photo && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={saisie.date} onChangeText={(date) => setSaisie({ ...saisie, date })} placeholder="AAAA-MM-JJ"
                           style={[champ, { flex: 1.3, minWidth: 0 }]} accessibilityLabel="Date de la sortie" />
                <TextInput value={saisie.km} onChangeText={(km) => setSaisie({ ...saisie, km })} placeholder="km"
                           keyboardType="decimal-pad" style={[champ, { flex: 1, minWidth: 0 }]} accessibilityLabel="Distance en km" />
                <TextInput value={saisie.dplus} onChangeText={(dplus) => setSaisie({ ...saisie, dplus })} placeholder="D+ m"
                           keyboardType="decimal-pad" style={[champ, { flex: 1, minWidth: 0 }]} accessibilityLabel="Dénivelé positif en mètres" />
              </View>
              <Pressable onPress={envoyerPhoto} accessibilityRole="button" style={S.bouton}>
                <Text style={S.boutonTexte}>Envoyer pour validation</Text>
              </Pressable>
            </View>
          )}
          {message && <Text style={{ color: message.startsWith("+") ? C.platFonce : C.monteeFonce, fontWeight: "600" }}
                            accessibilityRole="alert">{message}</Text>}
        </View>
      </Section>

      <Section titre="Classement">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[S.fort, { width: 22 }]}>1</Text>
            <Avatar a={profil.apparence} taille={40} cadrage="buste" />
            <Text style={[S.fort, { flex: 1 }]}>{profil.prenom} (toi)</Text>
            <Text style={S.fort}>{nombre(valides)} pts</Text>
          </View>
          <Text style={S.petit}>Le classement entre coureurs et les lots de fin d'année arrivent avec les comptes en ligne.</Text>
        </View>
      </Section>

      <Section titre="Mes sorties">
        <View style={{ gap: 8 }}>
          {profil.activites.length === 0 && <Text style={S.petit}>Aucune sortie pour l'instant.</Text>}
          {profil.activites.map((a) => {
            const [libelle, fond, texte] = STATUT[a.statut];
            return (
              <View key={a.id} style={[S.ligne, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={S.fort}>{new Date(a.date).toLocaleDateString("fr-FR")} · {nombre(a.distance_km, 1)} km · +{nombre(a.dplus_m)} m</Text>
                  <Text style={S.petit}>{a.source === "gpx" ? "GPX" : "Capture d'écran"}
                    {a.repetitions.map((r) => ` · ${r.n} × ${r.nom || `côte de ${Math.round(r.longueur_m)} m`}`).join("")}
                    {a.motif ? ` · ${a.motif}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={S.fort}>{a.statut === "refusee" ? "0" : `+${a.points}`}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
                                 overflow: "hidden", backgroundColor: fond, color: texte }}>{libelle}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      <Section titre="Comment gagner des points">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          {[[`${BAREME.parKm} point`, "par kilomètre"], [`${BAREME.parDplus10m} point`, "par 10 m de dénivelé positif"],
            ["1 point / 5 m de D+", "à chaque montée d'une côte de l'appli"], [`${BAREME.plafondKmSemaine} km`, "comptés au plus par semaine"]]
            .map(([valeur, texte]) => (
              <View key={texte} style={{ flexDirection: "row", gap: 10 }}>
                <Text style={[S.fort, { width: 150 }]}>{valeur}</Text>
                <Text style={[S.petit, { flex: 1, color: C.encre }]}>{texte}</Text>
              </View>
            ))}
          <Text style={S.petit}>Seules les sorties faites après la création du compte comptent.</Text>
        </View>
      </Section>
    </ScrollView>
  );
}
