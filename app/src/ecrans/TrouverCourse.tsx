// Ma course → « Trouver » : on dit ce qu'on cherche en quelques gestes (quand, quelle distance,
// quel dénivelé, trail ou route, jusqu'où), et les courses qui collent s'affichent, de la plus
// proche dans le temps à la plus lointaine. Chaque course ouvre sa fiche complète.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { coursesAVenir, FILTRES_AGENDA, prochainsMois, type CourseProche } from "../calcul/agenda.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { nombre } from "../composants/communs.tsx";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import type { CourseCible } from "../calcul/plan.ts";
import { ObjectifLibre } from "../composants/SansCourse.tsx";
import { C, S } from "../theme.ts";
import { AGENDA } from "./Agenda.tsx";

type Choix<T extends string> = [T, string][];
type Distance = "toutes" | "court" | "moyen" | "long" | "ultra";
type Denivele = "tous" | "plat" | "vallonne" | "montagne";
type Type = "toutes" | "trail" | "route";
type Rayon = "30" | "100" | "300" | "france";

const DISTANCES: Choix<Distance> = [["toutes", "Toutes"], ["court", "Moins de 15 km"], ["moyen", "15 à 30 km"], ["long", "30 à 60 km"], ["ultra", "Plus de 60 km"]];
const BORNES: Record<Distance, [number, number]> = { toutes: [0, Infinity], court: [0, 15], moyen: [15, 30], long: [30, 60], ultra: [60, Infinity] };
const DENIVELES: Choix<Denivele> = [["tous", "Tous"], ["plat", "Plat (moins de 300 m)"], ["vallonne", "300 à 1 500 m"], ["montagne", "Plus de 1 500 m"]];
const DPLUS: Record<Denivele, [number, number]> = { tous: [0, Infinity], plat: [0, 300], vallonne: [300, 1500], montagne: [1500, Infinity] };
const TYPES: Choix<Type> = [["toutes", "Trail et route"], ["trail", "Trail"], ["route", "Route"]];
const RAYONS: Choix<Rayon> = [["30", "30 km"], ["100", "100 km"], ["300", "300 km"], ["france", "Toute la France"]];

function Puces<T extends string>({ titre, options, valeur, onChange }: { titre: string; options: Choix<T>; valeur: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={S.surtitre}>{titre}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}>
        {options.map(([v, nom]) => {
          const actif = v === valeur;
          return (
            <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="radio" aria-checked={actif}
                       style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center",
                                backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: actif ? C.fond : C.encre }}>{nom}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const jour = (d: string) => new Date(`${d}T12:00:00`);

/** Une course dans la liste : la date en grand, le nom, où, les formats ; tout le reste dans la fiche. */
function CarteCourse({ c, ici, onOuvrir }: { c: CourseProche; ici: string; onOuvrir: () => void }) {
  const d = jour(c.date);
  const prix = c.prix_eur?.length ? `dès ${nombre(c.prix_eur[0], c.prix_eur[0] % 1 ? 2 : 0)} €` : null;
  return (
    <Pressable onPress={onOuvrir} accessibilityRole="button" accessibilityLabel={`${c.nom}, ${c.commune}, le ${d.toLocaleDateString("fr-FR")}. Ouvrir la fiche`}
               style={({ pressed }) => [S.ligne, { alignItems: "center", gap: 16, opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ width: 58, alignItems: "center", paddingVertical: 8, borderRadius: 14, backgroundColor: c.type === "trail" ? C.monteeClair : C.aire }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: C.gris, textTransform: "uppercase" }}>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</Text>
        <Text style={{ fontSize: 24, fontWeight: "900", color: C.encre }}>{d.getDate()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={S.fort} numberOfLines={2}>{c.nom}</Text>
        <Text style={S.petit} numberOfLines={1}>{c.commune} · {kmLisibles(c.distance_m)} de {ici}</Text>
        <Text style={[S.petit, { color: C.encre }]} numberOfLines={1}>
          {c.type === "trail" ? "Trail" : "Route"}{c.distances_km.length ? ` · ${c.distances_km.map((k) => `${String(k).replace(".", ",")} km`).join(", ")}` : ""}
          {c.dplus_m ? ` · ${nombre(c.dplus_m)} m D+` : ""}{prix ? ` · ${prix}` : ""}
        </Text>
        {(c.connue || c.complet) && (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
            {!!c.connue && <Text style={{ fontSize: 12, fontWeight: "800", color: "#8A6A00", backgroundColor: "#FBF0C9", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>★ Course connue</Text>}
            {c.complet && <Text style={{ fontSize: 12, fontWeight: "800", color: C.monteeFonce, backgroundColor: C.monteeClair, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>Complet</Text>}
          </View>
        )}
      </View>
      <Text style={{ fontSize: 22, color: C.gris }}>›</Text>
    </Pressable>
  );
}

export function EcranTrouverCourse({ depart, localisation, onRecherche, onLocaliser, onOuvrir, mesCourses, cible, onMesCourses, onVoirPlan, onObjectif }: {
  depart: PointDepart; localisation: Localisation; onRecherche: () => void; onLocaliser: () => void; onOuvrir: (c: CourseProche) => void;
  mesCourses: CourseInscrite[]; cible: CourseCible | null; onMesCourses: () => void; onVoirPlan: () => void; onObjectif: (c: CourseCible) => void;
}) {
  const [mois, setMois] = useState("");
  const [distance, setDistance] = useState<Distance>("toutes");
  const [denivele, setDenivele] = useState<Denivele>("tous");
  const [type, setType] = useState<Type>("toutes");
  const [rayon, setRayon] = useState<Rayon>("100");
  const [combien, setCombien] = useState(20);
  const ici = depart.gps ? "toi" : depart.nom.split(",")[0];

  const resultats = useMemo(() => {
    const [kmMin, kmMax] = BORNES[distance];
    const [dMin, dMax] = DPLUS[denivele];
    return coursesAVenir(AGENDA, depart.position, {
      ...FILTRES_AGENDA, rayonKm: rayon === "france" ? Infinity : Number(rayon), moisMax: 14, type, tri: "date", mois: mois || undefined,
      kmMin: distance === "toutes" ? undefined : kmMin, kmMax: distance === "toutes" ? undefined : kmMax,
    }).filter((c) => denivele === "tous" || (c.dplus_m === null ? denivele === "plat" && c.type === "route" : c.dplus_m >= dMin && c.dplus_m < dMax));
  }, [depart.position, mois, distance, denivele, type, rayon]);

  return (
    <ScrollView style={S.ecran} contentContainerStyle={[S.contenu, { gap: 26, paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
      {cible && (
        <Pressable onPress={onVoirPlan} accessibilityRole="button" style={[S.ligne, { marginTop: 16, backgroundColor: C.foret }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "#F6F4EFB3", fontSize: 13, fontWeight: "800", letterSpacing: 1 }}>MA COURSE</Text>
            <Text style={{ color: C.fond, fontSize: 18, fontWeight: "900" }} numberOfLines={2}>{cible.nom}</Text>
            <Text style={{ color: "#F6F4EFB3", fontSize: 14 }}>{cible.date ? new Date(`${cible.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "date à fixer"} · voir mon plan</Text>
          </View>
          <Text style={{ fontSize: 24, color: C.fond }}>›</Text>
        </Pressable>
      )}
      <Pressable onPress={onMesCourses} accessibilityRole="button" style={[S.ligne, { marginTop: cible ? 0 : 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={S.fort}>Mes courses de l'année{mesCourses.length ? ` (${mesCourses.length})` : ""}</Text>
          <Text style={S.petit}>Celles qui te tentent et celles où tu es inscrit : compte à rebours, budget</Text>
        </View>
        <Text style={{ fontSize: 22, color: C.gris }}>›</Text>
      </Pressable>
      <BarreDepart titre="Autour de" depart={depart} localisation={localisation} onRecherche={onRecherche} onLocaliser={onLocaliser} />
      <Puces titre="Quand" options={[["", "Tous les mois"], ...prochainsMois().map((m) => [m.cle, m.nom] as [string, string])]} valeur={mois} onChange={setMois} />
      <Puces titre="Distance" options={DISTANCES} valeur={distance} onChange={setDistance} />
      <Puces titre="Dénivelé" options={DENIVELES} valeur={denivele} onChange={setDenivele} />
      <Puces titre="Type" options={TYPES} valeur={type} onChange={setType} />
      <Puces titre="Jusqu'à" options={RAYONS} valeur={rayon} onChange={setRayon} />

      <View style={{ gap: 12 }}>
        <Text style={S.h2} accessibilityRole="header">
          {resultats.length ? `${resultats.length} course${resultats.length > 1 ? "s" : ""}` : "Aucune course"}
        </Text>
        {!resultats.length && (
          <Text style={S.texte}>
            Rien avec ces critères. Élargis la distance de recherche ou le mois : beaucoup d'organisateurs publient leur date quelques
            mois avant. Le calendrier se met à jour chaque jour.
          </Text>
        )}
        {resultats.slice(0, combien).map((c) => <CarteCourse key={c.id} c={c} ici={ici} onOuvrir={() => onOuvrir(c)} />)}
        {resultats.length > combien && (
          <Pressable onPress={() => setCombien(combien + 20)} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Voir 20 courses de plus</Text>
          </Pressable>
        )}
      </View>
      <ObjectifLibre onObjectif={onObjectif} />
      <Text style={S.petit}>
        Courses publiées par les offices de tourisme (DATAtourisme) et les agendas publics (OpenAgenda), mises à jour chaque jour. Toutes
        les courses n'y sont pas encore : ajoute la tienne dans « Mes courses ».
      </Text>
    </ScrollView>
  );
}
