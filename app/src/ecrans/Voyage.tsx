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
import { trainDirect, type OffreTrain } from "../calcul/train.ts";
import { dernierJour, garesProches, heure, indiceJour, trainsDirects, type TrainDirect } from "../calcul/horaires.ts";
import { chargerGares, chargerPassages, chargerServices } from "../horaires.ts";
import { chargerTarifs } from "../trains.ts";
import { autourDeLaCourse } from "../voyage.ts";
import { C, S } from "../theme.ts";

const CARBURANTS = carburantsBruts as Carburants;
const euros = (v: number) => `${nombre(v, v < 100 ? 2 : 0)} €`;
/** Prix de billet : sans centimes quand il n'y en a pas (« 25,50 € », « 51 € »). */
const prix = (v: number) => `${nombre(v, Number.isInteger(v) ? 0 : 2)} €`;
const ouvrir = (url: string) => Linking.openURL(url).catch(() => undefined);
const jourCourt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const jourLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function Lien({ texte, url, detail }: { texte: string; url: string; detail?: string }) {
  return (
    <Pressable onPress={() => ouvrir(url)} accessibilityRole="link" style={[S.boutonClair, { alignItems: "flex-start", paddingVertical: 10 }]}>
      <Text style={S.boutonClairTexte}>{texte} ↗</Text>
      {detail ? <Text style={S.petit}>{detail}</Text> : null}
    </Pressable>
  );
}

export function VueVoyage({ course, depart, onRetour, entete }: {
  course: CourseProche; depart: PointDepart; onRetour: () => void;
  /** en-tête de la fiche course : remplace le titre simple quand le voyage est inclus dans la fiche */
  entete?: React.ReactNode;
}) {
  const arrivee = { lat: course.lat, lon: course.lon };
  const [trajet, setTrajet] = useState<Trajet | null | undefined>(undefined);
  const [autour, setAutour] = useState<{ logements: Logement[]; gares: Gare[] } | null | undefined>(undefined);
  const [carbu, setCarbu] = useState<Carburant>("gazole");
  const [conso, setConso] = useState(6.5);
  const [personnes, setPersonnes] = useState(1);
  // train direct (TGV INOUI, OUIGO, Intercités) : undefined = en cours, null = pas de données (hors connexion)
  const [train, setTrain] = useState<OffreTrain | null | undefined | "aucun">(undefined);
  // horaires des trains directs, la veille ou le jour de la course
  const [jourTrain, setJourTrain] = useState<"veille" | "jourj">("veille");
  const [horaires, setHoraires] = useState<TrainDirect[] | { hors: string } | null | undefined>(undefined);
  // gare SNCF la plus proche de la course (liste officielle des gares desservies, TER compris)
  const [gareSncf, setGareSncf] = useState<{ nom: string; d: number } | null>(null);
  useEffect(() => {
    let actif = true;
    setHoraires(undefined);
    (async () => {
      const [s, gares] = await Promise.all([chargerServices(), chargerGares()]);
      if (!s || !gares) return null;
      const proche = garesProches(gares, arrivee, 60000, 1)[0];
      if (actif) setGareSncf(proche ? { nom: proche.nom, d: proche.d } : null);
      const jour = jourTrain === "veille" ? veille(course.date) : course.date;
      if (indiceJour(s, jour) === null) return { hors: dernierJour(s) };
      // gares à 40 km de chez toi et à 30 km du départ de la course (4 de chaque côté au plus)
      const avec = (g: { uic: string; nom: string; d: number }[]) =>
        Promise.all(g.map(async (x) => ({ ...x, passages: (await chargerPassages(x.uic)) ?? [] })));
      const [dep, arr] = await Promise.all([avec(garesProches(gares, depart.position, 40000)), avec(garesProches(gares, arrivee, 30000))]);
      return trainsDirects(s, jour, dep, arr);
    })().then((h) => { if (actif) setHoraires(h); }).catch(() => { if (actif) setHoraires(null); });
    return () => { actif = false; };
  }, [course.id, jourTrain, depart.position.lat, depart.position.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let actif = true;
    itineraire(depart.position, arrivee, "car").then((t) => { if (actif) setTrajet(t); });
    autourDeLaCourse(arrivee).then((a) => { if (actif) setAutour(a); });
    chargerTarifs().then((t) => { if (actif) setTrain(t ? trainDirect(t, depart.position, arrivee) ?? "aucun" : null); });
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
      {entete ?? (
        <>
          <Pressable onPress={onRetour} accessibilityRole="button" hitSlop={8} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.montee }}>← Retour</Text>
          </Pressable>
          <Text style={[S.titre, { fontSize: 24, marginTop: 10 }]} accessibilityRole="header">{course.nom}</Text>
          <Text style={S.sousTitre}>{course.commune} · {jourLong(course.date)} · à {kmLisibles(course.distance_m)} de {depart.gps ? "toi" : depart.nom.split(",")[0]} à vol d'oiseau</Text>
        </>
      )}
      {entete ? <Text style={[S.h2, { marginTop: 40 }]} accessibilityRole="header">Y aller et dormir</Text> : null}

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
          {gareSncf ? <Text style={S.fort}>Gare la plus proche : {gareSncf.nom}, à {kmLisibles(gareSncf.d)} du départ (à vol d'oiseau)</Text>
            : autour === undefined ? <Text style={S.petit}>Recherche de la gare la plus proche…</Text>
            : gare ? <Text style={S.fort}>Gare la plus proche : {gare.nom}, à {kmLisibles(gare.distance_m)} du départ</Text>
            : <Text style={S.petit}>{autour === null ? "Gares indisponibles (pas de connexion)." : "Pas de gare à moins de 25 km : prévois une navette ou un covoiturage depuis la gare."}</Text>}
          <Segments options={[["veille", `La veille (${jourCourt(veille(course.date))})`], ["jourj", `Le jour J (${jourCourt(course.date)})`]]}
                    valeur={jourTrain} onChange={setJourTrain} />
          {horaires === undefined && <View style={{ flexDirection: "row", gap: 8 }}><ActivityIndicator color={C.encre} /><Text style={S.petit}>Recherche des trains directs…</Text></View>}
          {horaires === null && <Text style={S.petit}>Horaires indisponibles sans connexion.</Text>}
          {horaires && !Array.isArray(horaires) && (
            <Text style={S.petit}>La SNCF publie ses horaires environ 5 mois à l'avance : ceux de ce jour-là ne sont pas encore connus (publiés jusqu'au {jourCourt(horaires.hors)}). Reviens plus tard.</Text>
          )}
          {Array.isArray(horaires) && horaires.length === 0 && (
            <Text style={S.petit}>Pas de train direct ce jour-là entre les gares proches de chez toi et de la course : il faudra une correspondance (cherche sur SNCF Connect).</Text>
          )}
          {Array.isArray(horaires) && horaires.slice(0, 10).map((t) => (
            <View key={`${t.numero}-${t.depart}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.aire }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort}>{heure(t.depart)} → {heure(t.arrivee)} <Text style={{ fontWeight: "500", color: C.gris }}>· {dureeLisible(t.duree)}</Text></Text>
                <Text style={S.petit} numberOfLines={2}>{t.mode} {t.numero} · {t.gareDepart} → {t.gareArrivee}</Text>
              </View>
            </View>
          ))}
          {Array.isArray(horaires) && horaires.length > 10 && <Text style={S.petit}>Et {horaires.length - 10} autres trains directs ce jour-là.</Text>}
          {Array.isArray(horaires) && horaires.length > 0 && (
            <Text style={[S.petit, { fontSize: 12 }]}>Horaires théoriques SNCF (TGV INOUI, OUIGO, Intercités, TER, cars TER) : vérifie avant de partir (travaux, grèves).</Text>
          )}
          {train === undefined && <Text style={S.petit}>Recherche des prix…</Text>}
          {train && train !== "aucun" && (
            <View style={{ backgroundColor: C.descenteClair, borderRadius: 14, padding: 12, gap: 4 }}>
              <Text style={[S.fort, { color: C.descenteFonce }]}>{train.gareDepart} → {train.gareArrivee}, sans changement</Text>
              <Text style={[S.fort, { color: C.descenteFonce, fontSize: 18 }]}>
                {prix(train.prixMin)} à {prix(train.prixMax)} par trajet · aller-retour {prix(train.prixMin * 2)} à {prix(train.prixMax * 2)}
              </Text>
              <Text style={S.petit}>
                {train.transporteurs.join(", ")} · plein tarif 2de classe : le prix bas en réservant tôt ou en heure creuse, le haut
                au dernier moment. Les cartes Avantage, Max Jeune et les promotions font souvent moins cher.
              </Text>
              <Text style={S.petit}>
                Gare à {kmLisibles(train.accesDepart_m)} de {depart.gps ? "toi" : depart.nom.split(",")[0]} et à {kmLisibles(train.accesArrivee_m)} du
                départ de la course (à vol d'oiseau).
              </Text>
            </View>
          )}
          {train === "aucun" && (
            <Text style={S.petit}>
              Pas de TGV ni d'Intercités direct entre les gares proches de chez toi et de la course : il faudra une correspondance
              ou un TER (les prix des TER ne sont pas publiés en données ouvertes).
            </Text>
          )}
          {train === null && <Text style={S.petit}>Prix des trains indisponibles sans connexion.</Text>}
          <Text style={S.petit}>Réserve tôt : les billets ouvrent environ 3 à 4 mois avant, et les prix montent quand le train se remplit.</Text>
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
        Itinéraire IGN (Géoplateforme) · prix des carburants : flux officiel du ministère de l'Économie (Licence Ouverte) · prix des
        trains : SNCF Voyageurs, données ouvertes (ODbL) · liens sans affiliation.
      </Text>
    </ScrollView>
  );
}
