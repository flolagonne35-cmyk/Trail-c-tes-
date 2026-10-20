// Écran « Détail d'une côte » : chiffres, profil, pente tous les 50 m, itinéraire et export GPX.

import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { dureeMontee, kmLisibles, type CoteProche } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { adresseDe, itineraire } from "../calcul/geoservices.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { dureeLisible, NOMS_MODES, tempsTrajets, type TempsTrajet } from "../calcul/trajets.ts";
import { coutMinetti } from "../calcul/nutrition.ts";
import { BAREME, pointsRepetition } from "../calcul/points.ts";
import { Ajusteur, EnTete, nombre, Tuiles } from "../composants/communs.tsx";
import { BarresPentes, ProfilCote } from "../composants/graphiques.tsx";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { centreDe, zoomAjuste } from "../calcul/tuiles.ts";
import { partagerFichier } from "../fichiers.ts";
import { C, S } from "../theme.ts";

const SEUIL_RAIDE = 12;

function urlItineraire(lat: number, lon: number) {
  if (Platform.OS === "ios") return `maps://?daddr=${lat},${lon}&dirflg=w`;
  if (Platform.OS === "android") return `geo:${lat},${lon}?q=${lat},${lon}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lon}`;
}

export function EcranDetail({ cote, rang, allurePlat, depart, nomDepart, retour }: {
  cote: CoteProche; rang: number; allurePlat: number; depart: Position; nomDepart: string; retour: () => void;
}) {
  const pied = { lat: cote.lat, lon: cote.lon };
  const trace = cote.geometrie.length ? cote.geometrie.map(([lon, lat]) => ({ lat, lon })) : [pied];
  const [adresse, setAdresse] = useState<string | null | undefined>(cote.adresse || undefined);
  const [trajets, setTrajets] = useState<TempsTrajet[]>(() => tempsTrajets(depart, pied, allurePlat));
  const [calcul, setCalcul] = useState(true);
  useEffect(() => {
    let actif = true;
    if (!cote.adresse) adresseDe(pied).then((a) => actif && setAdresse(a));
    Promise.all([itineraire(depart, pied, "car"), itineraire(depart, pied, "pedestrian")])
      .then(([voiture, pieton]) => { if (actif) setTrajets(tempsTrajets(depart, pied, allurePlat, voiture, pieton)); })
      .finally(() => actif && setCalcul(false));
    return () => { actif = false; };
  }, [cote.id, depart.lat, depart.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = dureeMontee(cote, allurePlat, coutMinetti);
  // séance de répétitions : environ 1,5 km de montées au total, retour en trottinant
  const [reps, setReps] = useState(Math.min(15, Math.max(4, Math.round(1500 / Math.max(cote.longueur_m, 100)))));
  const dureeSeance = reps * (minutes + (cote.longueur_m / 1000) * allurePlat * 1.3);
  const pointsSeance = Math.round(reps * pointsRepetition(cote) + (2 * reps * cote.longueur_m / 1000) * BAREME.parKm
                                  + (reps * cote.dplus_m / 10) * BAREME.parDplus10m);
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

      <View style={{ marginTop: 14 }}>
        <Carte hauteur={240} cle={`cote-${cote.id}`} centre={centreDe(trace)} zoom={zoomAjuste(trace, 360, 240, 12, 17)}
               position={depart} traces={[{ id: cote.id, points: trace, couleur: couleurPente(cote.pente_moy_pct), epaisseur: 6 }]}
               marqueurs={[
                 { id: "d", position: trace[0], texte: "D", couleur: C.descente, label: "Départ, pied de la côte" },
                 { id: "a", position: trace[trace.length - 1], texte: "A", couleur: C.encre, label: "Arrivée, sommet" },
               ]} />
      </View>

      <View style={[S.carte, { gap: 6 }]}>
        <Text style={[S.surtitre, { fontSize: 12 }]}>Départ de la côte</Text>
        <Text style={S.fort} selectable>
          {adresse === undefined ? "Recherche de l'adresse…" : adresse ?? "Adresse introuvable"}
        </Text>
        <Text style={S.petit} selectable>GPS : {cote.lat.toFixed(5)}, {cote.lon.toFixed(5)}</Text>
        <Text style={[S.surtitre, { fontSize: 12, marginTop: 8 }]}>Pour y aller depuis {nomDepart}</Text>
        {trajets.map((t) => (
          <View key={t.mode} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={S.fort}>{NOMS_MODES[t.mode][0].toUpperCase() + NOMS_MODES[t.mode].slice(1)}</Text>
            <Text style={S.fort}>{t.estime ? "≈ " : ""}{dureeLisible(t.minutes)}
              <Text style={S.petit}> · {kmLisibles(t.distance_m)}</Text></Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {calcul && <ActivityIndicator size="small" color={C.gris} />}
          <Text style={S.petit}>
            {calcul ? "Calcul des itinéraires IGN…" : trajets.some((t) => t.mode !== "velo" && !t.estime)
              ? `Itinéraires IGN ; en courant à ${Math.floor(allurePlat)}:${String(Math.round((allurePlat % 1) * 60)).padStart(2, "0")} /km ; vélo estimé à 16 km/h.`
              : "Itinéraires indisponibles : temps estimés (≈) d'après la distance."}
          </Text>
        </View>
      </View>

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

      <View style={[S.carte, { marginTop: 10, gap: 8 }]}>
        <Text style={[S.surtitre, { fontSize: 12 }]}>Séance de côtes</Text>
        <Ajusteur etiquette="Répétitions" valeur={reps} unite="×" pas={1} min={1} max={30} onChange={setReps} />
        <Text style={S.petit}>Montée à allure soutenue, retour en trottinant. ≈ {nombre(Math.round(dureeSeance))} min,
          +{nombre(Math.round(reps * cote.dplus_m))} m de D+, ≈ {nombre(pointsSeance)} points avec le GPX de la séance
          (sans l'échauffement).</Text>
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
