// Écran « Moi » : création de l'avatar (premier lancement), points, sorties, classement.

import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import type { Cote } from "../calcul/cotes.ts";
import { activiteDepuisGpx, activiteDepuisPhoto, BAREME, score, type Activite } from "../calcul/points.ts";
import { Avatar } from "../composants/Avatar.tsx";
import { EnTete, nombre, Puce, Tuiles } from "../composants/communs.tsx";
import { choisirGpx } from "../fichiers.ts";
import { APPARENCE_DEFAUT, CHEVEUX, COUPES, PEAUX, TENUES, type Apparence, type Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 44, fontSize: 15,
                color: C.encre } as const;

function Pastilles({ couleurs, choix, onChoix, nom }: { couleurs: string[]; choix: number; onChoix: (i: number) => void; nom: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {couleurs.map((c, i) => (
        <Pressable key={c} onPress={() => onChoix(i)} accessibilityRole="button" accessibilityLabel={`${nom} ${i + 1}`}
                   accessibilityState={{ selected: i === choix }}
                   style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
                            borderWidth: 3, borderColor: i === choix ? C.encre : "transparent" }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: 1, borderColor: "#0002" }} />
        </Pressable>
      ))}
    </View>
  );
}

function Editeur({ prenom, setPrenom, a, setA }: { prenom: string; setPrenom: (s: string) => void; a: Apparence; setA: (a: Apparence) => void }) {
  const titre = (t: string) => <Text style={[S.surtitre, { fontSize: 12, marginTop: 6 }]}>{t}</Text>;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignItems: "center", marginTop: 8 }}><Avatar a={a} taille={150} /></View>
      {titre("Prénom ou pseudo")}
      <TextInput value={prenom} onChangeText={setPrenom} placeholder="ex. Théo" style={[champ, { backgroundColor: C.blanc }]} accessibilityLabel="Prénom ou pseudo" />
      {titre("Silhouette")}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Puce texte="Femme" actif={a.silhouette === "femme"} onPress={() => setA({ ...a, silhouette: "femme" })} />
        <Puce texte="Homme" actif={a.silhouette === "homme"} onPress={() => setA({ ...a, silhouette: "homme" })} />
      </View>
      {titre("Peau")}
      <Pastilles couleurs={PEAUX} choix={a.peau} onChoix={(peau) => setA({ ...a, peau })} nom="Teinte de peau" />
      {titre("Coupe")}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {COUPES.map(([c, nom]) => <Puce key={c} texte={nom} actif={a.coupe === c} onPress={() => setA({ ...a, coupe: c })} />)}
      </View>
      {titre("Cheveux")}
      <Pastilles couleurs={CHEVEUX} choix={a.cheveux} onChoix={(cheveux) => setA({ ...a, cheveux })} nom="Couleur de cheveux" />
      {titre("Maillot")}
      <Pastilles couleurs={TENUES} choix={a.haut} onChoix={(haut) => setA({ ...a, haut })} nom="Couleur du maillot" />
      {titre("Short")}
      <Pastilles couleurs={TENUES} choix={a.bas} onChoix={(bas) => setA({ ...a, bas })} nom="Couleur du short" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={S.fort}>Casquette</Text>
        <Switch value={a.casquette} onValueChange={(casquette) => setA({ ...a, casquette })} accessibilityLabel="Casquette" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <Text style={S.fort}>Bâtons de trail</Text>
        <Switch value={a.batons} onValueChange={(batons) => setA({ ...a, batons })} accessibilityLabel="Bâtons de trail" />
      </View>
    </View>
  );
}

const STATUT: Record<Activite["statut"], [string, string, string]> = {
  validee: ["Validée", C.platClair, C.platFonce],
  en_attente: ["En attente", C.descenteClair, C.descenteFonce],
  refusee: ["Refusée", C.monteeClair, C.monteeFonce],
};

export function EcranMoi({ profil, setProfil, cotes }: { profil: Profil | null; setProfil: (p: Profil) => void; cotes: Cote[] }) {
  const [edition, setEdition] = useState(!profil);
  const [prenom, setPrenom] = useState(profil?.prenom ?? "");
  const [apparence, setApparence] = useState<Apparence>(profil?.apparence ?? APPARENCE_DEFAUT);
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saisie, setSaisie] = useState({ date: new Date().toISOString().slice(0, 10), km: "", dplus: "" });

  if (edition || !profil) {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <EnTete surtitre={profil ? "Mon avatar" : "Bienvenue"} titre={profil ? "Modifier mon avatar" : "Crée ton coureur"}
                sousTitre={profil ? undefined : "Il te représente dans le classement. Les points comptent à partir d'aujourd'hui."} />
        <Editeur prenom={prenom} setPrenom={setPrenom} a={apparence} setA={setApparence} />
        <Pressable accessibilityRole="button" disabled={!prenom.trim()}
                   onPress={() => {
                     setProfil(profil ? { ...profil, prenom: prenom.trim(), apparence }
                                      : { prenom: prenom.trim(), apparence, creeLe: new Date().toISOString(), activites: [] });
                     setEdition(false);
                   }}
                   style={[S.bouton, { marginTop: 16, opacity: prenom.trim() ? 1 : 0.4 }]}>
          <Text style={S.boutonTexte}>{profil ? "Enregistrer" : "C'est parti"}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const { valides, enAttente } = score(profil.activites);
  const ajouter = (a: Activite) => {
    setProfil({ ...profil, activites: [a, ...profil.activites] });
    setMessage(a.statut === "refusee" ? `Sortie refusée : ${a.motif}`
      : a.statut === "en_attente" ? `${a.points} points en attente de validation.`
      : `+${a.points} points${a.repetitions.length ? ` dont ${a.repetitions.reduce((s, r) => s + r.n, 0)} montées de côtes` : ""} !`);
  };

  async function ajouterGpx() {
    setMessage(null);
    try {
      const f = await choisirGpx();
      if (f) ajouter(activiteDepuisGpx(f.texte, cotes, profil!.creeLe, profil!.activites.map((a) => a.empreinte)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  async function choisirPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled && r.assets?.length) setPhoto(r.assets[0].uri);
  }

  function validerPhoto() {
    const km = parseFloat(saisie.km.replace(",", "."));
    const dplus = parseFloat(saisie.dplus.replace(",", ".") || "0");
    if (!photo || !Number.isFinite(km) || km <= 0 || !Number.isFinite(dplus) || !/^\d{4}-\d{2}-\d{2}$/.test(saisie.date)) {
      setMessage("Il faut la capture, la date (AAAA-MM-JJ), la distance et le D+.");
      return;
    }
    ajouter(activiteDepuisPhoto({ date: `${saisie.date}T12:00:00Z`, distance_km: km, dplus_m: dplus, photo }, profil!.creeLe));
    setPhoto(null);
    setSaisie({ ...saisie, km: "", dplus: "" });
  }

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
        <Avatar a={profil.apparence} taille={90} />
        <View style={{ flex: 1 }}>
          <Text style={S.surtitre}>Mon profil</Text>
          <Text style={S.titre}>{profil.prenom}</Text>
          <Text style={S.petit}>Points depuis le {new Date(profil.creeLe).toLocaleDateString("fr-FR")}</Text>
        </View>
      </View>
      <Pressable onPress={() => setEdition(true)} accessibilityRole="button" style={[S.boutonClair, { marginTop: 10, minHeight: 44 }]}>
        <Text style={S.boutonClairTexte}>Modifier mon avatar</Text>
      </Pressable>
      <Tuiles valeurs={[["Points", nombre(valides)], ["En attente", nombre(enAttente)],
                        ["Sorties", nombre(profil.activites.filter((a) => a.statut === "validee").length)]]} />

      <View style={[S.carte, { gap: 10 }]}>
        <Text style={S.surtitre}>Ajouter une sortie</Text>
        <Pressable onPress={ajouterGpx} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>Fichier GPX (validé tout de suite)</Text>
        </Pressable>
        <Text style={S.petit}>Garmin Connect et Strava exportent le GPX d'une sortie. Les montées des côtes de l'appli
          sont comptées automatiquement.</Text>
        <Pressable onPress={choisirPhoto} accessibilityRole="button" style={S.boutonClair}>
          <Text style={S.boutonClairTexte}>{photo ? "Capture choisie ✓ — changer" : "Capture Strava / Garmin"}</Text>
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
            <Pressable onPress={validerPhoto} accessibilityRole="button" style={S.bouton}>
              <Text style={S.boutonTexte}>Envoyer pour validation</Text>
            </Pressable>
          </View>
        )}
        {message && <Text style={{ color: message.startsWith("+") ? C.platFonce : C.monteeFonce, fontWeight: "600" }}
                          accessibilityRole="alert">{message}</Text>}
      </View>

      <View style={[S.carte, { gap: 6 }]}>
        <Text style={S.surtitre}>Barème</Text>
        <Text style={S.petit}>{BAREME.parKm} point par km · {BAREME.parDplus10m} point par 10 m de D+ · chaque montée d'une
          côte de l'appli : 1 point par 5 m de D+ de la côte · distance comptée jusqu'à {BAREME.plafondKmSemaine} km par semaine
          · seules les sorties après la création du compte comptent.</Text>
      </View>

      <View style={[S.carte, { gap: 6 }]}>
        <Text style={S.surtitre}>Classement</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={S.fort}>1</Text>
          <Avatar a={profil.apparence} taille={32} />
          <Text style={[S.fort, { flex: 1 }]}>{profil.prenom}</Text>
          <Text style={S.fort}>{nombre(valides)} pts</Text>
        </View>
        <Text style={S.petit}>Le classement entre coureurs et les lots de fin d'année arrivent avec les comptes en ligne.</Text>
      </View>

      <Text style={[S.h2, { marginTop: 16, marginBottom: 8 }]} accessibilityRole="header">Mes sorties</Text>
      <View style={{ gap: 8 }}>
        {profil.activites.length === 0 && <Text style={S.petit}>Aucune sortie pour l'instant.</Text>}
        {profil.activites.map((a) => {
          const [libelle, fond, texte] = STATUT[a.statut];
          return (
            <View key={a.id} style={[S.ligne, { alignItems: "flex-start" }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort}>{new Date(a.date).toLocaleDateString("fr-FR")} · {nombre(a.distance_km, 1)} km · +{nombre(a.dplus_m)} m</Text>
                <Text style={S.petit}>{a.source === "gpx" ? "GPX" : "Capture d'écran"}
                  {a.repetitions.map((r) => ` · ${r.n} × ${r.nom || `côte ${Math.round(r.longueur_m)} m`}`).join("")}
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
    </ScrollView>
  );
}
