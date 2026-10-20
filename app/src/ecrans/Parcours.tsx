// Écran « Parcours segmenté » : profil coloré, chiffres clés, segments ; import d'un GPX.

import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { analyserGpx } from "../calcul/parcours.ts";
import type { Parcours } from "../calcul/profil.ts";
import { EnTete, nombre, Tuiles } from "../composants/communs.tsx";
import { ProfilParcours } from "../composants/graphiques.tsx";
import { choisirGpx } from "../fichiers.ts";
import { C, COULEUR_TYPE, S } from "../theme.ts";

export function EcranParcours({ parcours, onParcours }: { parcours: Parcours; onParcours: (p: Parcours) => void }) {
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tout, setTout] = useState(false);

  async function importer() {
    setErreur(null);
    try {
      const fichier = await choisirGpx();
      if (!fichier) return;
      setEtat("Lecture de la trace…");
      const p = await analyserGpx(fichier.texte, {
        nom: fichier.nom,
        onProgres: (fait, total) => setEtat(`Altitudes IGN : ${Math.round((100 * fait) / total)} %`),
      });
      onParcours(p);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEtat(null);
    }
  }

  const segments = tout ? parcours.segments : parcours.segments.slice(0, 6);
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <EnTete surtitre="Analyse du parcours" titre={parcours.nom}
              sousTitre={`${nombre(parcours.distance_km, 1)} km · altitudes ${parcours.source_altitudes.startsWith("IGN")
                ? "IGN" : parcours.source_altitudes}`} />
      <Tuiles valeurs={[["D+", `${nombre(parcours.dplus_m)} m`], ["D−", `${nombre(parcours.dmoins_m)} m`],
                        ["Alt. max", `${nombre(parcours.alt_max_m)} m`]]} />
      <View style={S.carte}><ProfilParcours parcours={parcours} /></View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Pressable onPress={importer} disabled={!!etat} accessibilityRole="button" style={[S.bouton, { flex: 1 }]}>
          <Text style={S.boutonTexte}>Importer un GPX</Text>
        </Pressable>
      </View>
      {etat && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 }}>
          <ActivityIndicator color={C.encre} /><Text style={S.petit}>{etat}</Text>
        </View>
      )}
      {erreur && <Text style={{ color: C.monteeFonce, marginTop: 8 }} accessibilityRole="alert">{erreur}</Text>}

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
        <Text style={S.h2} accessibilityRole="header">Segments</Text>
        <Text style={{ fontSize: 13, color: C.gris }}>{segments.length} sur {parcours.segments.length}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {segments.map((s) => {
          const couleur = COULEUR_TYPE[s.type];
          const signe = s.type === "descente" ? "−" : "+";
          const d = s.type === "descente" ? s.dmoins_m : s.dplus_m;
          return (
            <View key={s.n} style={S.ligne} accessible
                  accessibilityLabel={`${s.type} du km ${s.km_debut} au km ${s.km_fin}, ${signe}${d} mètres, ${s.pente_moy_pct} % de moyenne, ${s.difficulte}`}>
              <Text style={{ width: 78, textAlign: "center", fontSize: 12, fontWeight: "700", paddingVertical: 5,
                             borderRadius: 8, overflow: "hidden", backgroundColor: couleur.fond, color: couleur.texte }}>
                {s.type[0].toUpperCase() + s.type.slice(1)}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.encre }}>
                  km {nombre(s.km_debut, 1)} – {nombre(s.km_fin, 1)}
                </Text>
                <Text style={S.petit} numberOfLines={1}>{s.description} · {s.difficulte}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={S.fort}>{signe}{nombre(d)} m</Text>
                <Text style={S.petit}>{nombre(Math.abs(s.pente_moy_pct), 1)} % moy.</Text>
              </View>
            </View>
          );
        })}
      </View>
      {parcours.segments.length > 6 && (
        <Pressable onPress={() => setTout(!tout)} accessibilityRole="button" style={[S.boutonClair, { marginTop: 10 }]}>
          <Text style={S.boutonClairTexte}>{tout ? "Moins de segments" : "Tous les segments"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
