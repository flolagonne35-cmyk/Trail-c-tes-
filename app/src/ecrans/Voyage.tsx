// Courses → Calendrier → une course → « Y aller et dormir » : en voiture (itinéraire IGN, coût du
// carburant du jour, partage à plusieurs), en covoiturage, en train (gare la plus proche), et les
// logements autour du départ, avec des liens de réservation pré-remplis pour la veille.

import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";

import carburantsBruts from "../../assets/data/carburants.json";
import type { CourseProche } from "../calcul/agenda.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { itineraire, type Trajet } from "../calcul/geoservices.ts";
import { dureeLisible } from "../calcul/trajets.ts";
import { coutVoiture, liens, NOMS_CARBURANT, NOMS_LOGEMENT, veille, type Carburant, type Carburants, type Gare, type Logement } from "../calcul/voyage.ts";
import type { PointDepart } from "../composants/BarreDepart.tsx";
import { Ajusteur, nombre, Section, Segments } from "../composants/communs.tsx";
import { autourDeLaCourse } from "../voyage.ts";
import { C, S } from "../theme.ts";

const CARBURANTS = carburantsBruts as Carburants;
const euros = (v: number) => `${nombre(v, v < 100 ? 2 : 0)} €`;
const ouvrir = (url: string) => Linking.openURL(url).catch(() => undefined);
const jourLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function Lien({ texte, url, detail }: { texte: string; url: string; detail?: string }) {
  return (
    <Pressable onPress={() => ouvrir(url)} accessibilityRole="link" style={[S.boutonClair, { alignItems: "flex-start", paddingVertical: 10 }]}>
      <Text style={S.boutonClairTexte}>{texte} ↗</Text>
      {detail ? <Text style={S.petit}>{detail}</Text> : null}
    </Pressable>
  );
}

export function VueVoyage({ course, depart, onRetour }: { course: CourseProche; depart: PointDepart; onRetour: () => void }) {
  const arrivee = { lat: course.lat, lon: course.lon };
  const [trajet, setTrajet] = useState<Trajet | null | undefined>(undefined);
  const [autour, setAutour] = useState<{ logements: Logement[]; gares: Gare[] } | null | undefined>(undefined);
  const [carbu, setCarbu] = useState<Carburant>("gazole");
  const [conso, setConso] = useState(6.5);
  const [personnes, setPersonnes] = useState(1);
  useEffect(() => {
    let actif = true;
    itineraire(depart.position, arrivee, "car").then((t) => { if (actif) setTrajet(t); });
    autourDeLaCourse(arrivee).then((a) => { if (actif) setAutour(a); });
    return () => { actif = false; };
  }, [course.id, depart.position.lat, depart.position.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // sans itinéraire (pas de réseau) : vol d'oiseau × 1,3, l'écart moyen entre route et ligne droite
  const distance = trajet?.distance_m ?? course.distance_m * 1.3;
  const cout = coutVoiture(distance, conso, CARBURANTS[carbu], personnes);
  const l = liens(depart.gps ? "" : depart.nom.split(",")[0], course.commune, course.date);
  const gare = autour?.gares[0];
  const loin = course.distance_m > 60000;

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onRetour} accessibilityRole="button" hitSlop={8} style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.montee }}>← Retour au calendrier</Text>
      </Pressable>
      <Text style={[S.titre, { fontSize: 24, marginTop: 10 }]} accessibilityRole="header">{course.nom}</Text>
      <Text style={S.sousTitre}>{course.commune} · {jourLong(course.date)} · à {kmLisibles(course.distance_m)} de {depart.gps ? "toi" : depart.nom.split(",")[0]} à vol d'oiseau</Text>

      <Section titre="🚗 En voiture">
        <View style={[S.carte, { marginTop: 0, gap: 12 }]}>
          {trajet === undefined ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><ActivityIndicator color={C.encre} /><Text style={S.petit}>Calcul de l'itinéraire…</Text></View>
          ) : (
            <Text style={[S.fort, { fontSize: 18 }]}>
              {kmLisibles(distance)}{trajet ? ` · ${dureeLisible(trajet.duree_min)}` : " environ (sans connexion : estimation)"} à l'aller
            </Text>
          )}
          <Segments options={(Object.keys(NOMS_CARBURANT) as Carburant[]).map((k) => [k, NOMS_CARBURANT[k]] as [Carburant, string])}
                    valeur={carbu} onChange={setCarbu} />
          <Ajusteur etiquette="Consommation" valeur={conso} unite="L/100" pas={0.5} min={3} max={15} onChange={setConso} />
          <Ajusteur etiquette="Personnes dans la voiture" valeur={personnes} unite="" pas={1} min={1} max={7} onChange={setPersonnes} />
          <View style={{ backgroundColor: C.monteeClair, borderRadius: 14, padding: 12, gap: 4 }}>
            <Text style={[S.fort, { color: C.monteeFonce, fontSize: 18 }]}>
              Aller-retour : ≈ {euros(cout.total)} de carburant{personnes > 1 ? `, soit ${euros(cout.parPersonne)} par personne` : ""}
            </Text>
            <Text style={S.petit}>
              {nombre(cout.litres, 0)} L à {nombre(CARBURANTS[carbu], 3)} €/L ({CARBURANTS.source}{CARBURANTS.date ? `, ${new Date(CARBURANTS.date).toLocaleDateString("fr-FR")}` : ""}).
              {loin ? " Péages en plus si tu prends l'autoroute : leur montant n'est pas publié en données ouvertes." : ""}
            </Text>
          </View>
          <Text style={S.petit}>Une voiture citadine consomme 5 à 6 L/100 km, un SUV ou un utilitaire 7 à 9.</Text>
        </View>
      </Section>

      <Section titre="🤝 En covoiturage">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          <Text style={S.petit}>Le plus économique, et souvent d'autres coureurs vont à la même course.</Text>
          <Lien texte="Chercher sur BlaBlaCar" url={l.covoiturage} detail={`${depart.gps ? "Départ à préciser" : depart.nom.split(",")[0]} → ${course.commune}, la veille (${jourLong(veille(course.date))})`} />
        </View>
      </Section>

      <Section titre="🚆 En train">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          {autour === undefined ? <Text style={S.petit}>Recherche de la gare la plus proche…</Text>
            : gare ? <Text style={S.fort}>Gare la plus proche : {gare.nom}, à {kmLisibles(gare.distance_m)} du départ</Text>
            : <Text style={S.petit}>{autour === null ? "Gares indisponibles (pas de connexion)." : "Pas de gare à moins de 25 km : prévois une navette ou un covoiturage depuis la gare."}</Text>}
          <Text style={S.petit}>Le prix du train dépend du jour de réservation : réserve tôt (les billets ouvrent environ 3 à 4 mois avant).</Text>
          <Lien texte="Horaires et prix sur SNCF Connect" url={l.train} />
        </View>
      </Section>

      <Section titre="🛏️ Dormir sur place">
        <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
          <Text style={S.petit}>Arriver la veille : retrait du dossard, nuit complète, pas de route au petit matin.</Text>
          {autour === undefined && <View style={{ flexDirection: "row", gap: 8 }}><ActivityIndicator color={C.encre} /><Text style={S.petit}>Recherche des logements…</Text></View>}
          {autour === null && <Text style={S.petit}>Logements indisponibles sans connexion : utilise les liens ci-dessous.</Text>}
          {autour?.logements.length === 0 && <Text style={S.petit}>Aucun logement recensé à moins de 8 km : regarde les villes voisines.</Text>}
          {autour?.logements.slice(0, 8).map((x) => (
            <View key={`${x.nom}-${x.lat}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.aire }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort} numberOfLines={1}>{x.nom}</Text>
                <Text style={S.petit}>{NOMS_LOGEMENT[x.type]}{x.etoiles ? ` ${"★".repeat(Math.min(5, x.etoiles))}` : ""} · à {kmLisibles(x.distance_m)} du départ</Text>
              </View>
              {x.site && (
                <Pressable onPress={() => ouvrir(x.site!)} accessibilityRole="link" accessibilityLabel={`Site de ${x.nom}`} hitSlop={6}>
                  <Text style={{ color: C.montee, fontWeight: "700" }}>Site ↗</Text>
                </Pressable>
              )}
            </View>
          ))}
          {!!autour?.logements.length && <Text style={[S.petit, { fontSize: 11 }]}>Logements © contributeurs OpenStreetMap (ODbL) ; vérifie les disponibilités.</Text>}
          <Lien texte="Voir les disponibilités sur Booking" url={l.booking} detail={`Nuit du ${jourLong(veille(course.date))}`} />
          <Lien texte="Voir les locations sur Airbnb" url={l.airbnb} />
        </View>
      </Section>
      <Text style={[S.petit, { marginTop: 14 }]}>
        Itinéraire IGN (Géoplateforme) · prix des carburants : flux officiel du ministère de l'Économie (Licence Ouverte) · liens sans affiliation.
      </Text>
    </ScrollView>
  );
}
