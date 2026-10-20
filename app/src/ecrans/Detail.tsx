// Écran « Détail d'une côte » : chiffres, profil, pente tous les 50 m, itinéraire et export GPX.

import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { dureeMontee, kmLisibles, type CoteProche } from "../calcul/cotes.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { coutMinetti } from "../calcul/nutrition.ts";
import { EnTete, nombre, Tuiles } from "../composants/communs.tsx";
import { BarresPentes, ProfilCote } from "../composants/graphiques.tsx";
import { partagerFichier } from "../fichiers.ts";
import { C, S } from "../theme.ts";

const SEUIL_RAIDE = 12;

function urlItineraire(lat: number, lon: number) {
  if (Platform.OS === "ios") return `maps://?daddr=${lat},${lon}&dirflg=w`;
  if (Platform.OS === "android") return `geo:${lat},${lon}?q=${lat},${lon}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lon}`;
}

export function EcranDetail({ cote, rang, allurePlat, retour }: {
  cote: CoteProche; rang: number; allurePlat: number; retour: () => void;
}) {
  const minutes = dureeMontee(cote, allurePlat, coutMinetti);
  const exporter = () => {
    const z = cote.profil.z;
    const n = cote.geometrie.length;
    const gpx = ecrireGpx(`Côte ${nombre(cote.longueur_m)} m à ${nombre(cote.pente_moy_pct, 1)} %${cote.nom ? ` — ${cote.nom}` : ""}`,
      cote.geometrie.map(([lon, lat], i) => ({ lat, lon, ele: z.length ? z[Math.round((i / Math.max(n - 1, 1)) * (z.length - 1))] : undefined })));
    return partagerFichier(`cote-${cote.id}.gpx`, gpx);
  };
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <EnTete retour={retour} surtitre={`Côte n°${rang} · à ${kmLisibles(cote.distance_m)}`}
              titre={`${nombre(Math.round(cote.longueur_m / 10) * 10)} m à ${nombre(cote.pente_moy_pct, 1)} %`}
              sousTitre={[cote.nom, cote.revetement, cote.technicite, "altitudes IGN au mètre"].filter(Boolean).join(" · ")} />
      <Tuiles valeurs={[["D+", `${nombre(cote.dplus_m)} m`], ["Pente max", `${nombre(cote.pente_max_pct)} %`],
                        ["Rythme*", `≈ ${nombre(Math.max(1, Math.round(minutes)))} min`]]} />

      <View style={S.carte}>
        <Text style={[S.surtitre, { fontSize: 12, paddingBottom: 6 }]}>Profil</Text>
        <ProfilCote cote={cote} seuilRaide={SEUIL_RAIDE} />
        <View style={{ flexDirection: "row", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
          {[[C.montee, `Pente ≤ ${SEUIL_RAIDE} %`], [C.monteeFonce, `Pente > ${SEUIL_RAIDE} %`]].map(([couleur, texte]) => (
            <View key={texte} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: couleur }} />
              <Text style={S.petit}>{texte}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[S.carte, { marginTop: 10 }]}>
        <Text style={[S.surtitre, { fontSize: 12, paddingBottom: 6 }]}>Pente tous les 50 m</Text>
        <BarresPentes pentes={cote.pentes_50m} longueur={cote.longueur_m} seuilRaide={SEUIL_RAIDE} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Pressable onPress={() => Linking.openURL(urlItineraire(cote.lat, cote.lon))} accessibilityRole="link"
                   style={[S.bouton, { flex: 1 }]}>
          <Text style={S.boutonTexte}>Y aller</Text>
        </Pressable>
        <Pressable onPress={exporter} accessibilityRole="button" style={[S.boutonClair, { flex: 1 }]}>
          <Text style={S.boutonClairTexte}>Export GPX</Text>
        </Pressable>
      </View>
      <Text style={[S.petit, { marginTop: 8 }]}>
        * Pour une allure de {Math.floor(allurePlat)}:{String(Math.round((allurePlat % 1) * 60)).padStart(2, "0")} /km sur
        le plat, corrigée par le coût énergétique de la pente. Le GPX s'importe dans l'application de la montre
        (Garmin Connect, Coros, Suunto…).
      </Text>
    </ScrollView>
  );
}
