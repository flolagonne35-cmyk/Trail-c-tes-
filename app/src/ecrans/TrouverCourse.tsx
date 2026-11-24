// Ma course → « Trouver » : on dit ce qu'on cherche en quelques gestes (quand, quelle distance,
// quel dénivelé, trail ou route, jusqu'où), et les courses qui collent s'affichent, de la plus
// proche dans le temps à la plus lointaine. Chaque course ouvre sa fiche complète.

import type React from "react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { coursesAVenir, FILTRES_AGENDA, type CourseProche } from "../calcul/agenda.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { BarreDepart, estInconnu, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { ChampDate, ChampNombre, Raccourcis } from "../composants/Champs.tsx";
import { nombre, Segments } from "../composants/communs.tsx";
import { useEtatGarde } from "../memoire.ts";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import type { CourseCible } from "../calcul/plan.ts";
import { ObjectifLibre } from "../composants/SansCourse.tsx";
import { C, S } from "../theme.ts";
import { AGENDA } from "./Agenda.tsx";

type Choix<T extends string> = [T, string][];
type Type = "toutes" | "trail" | "route";
const TYPES: Choix<Type> = [["toutes", "Trail et route"], ["trail", "Trail"], ["route", "Route"]];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dansMois = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return iso(d); };
const RACCOURCIS_QUAND: [string, () => [string, string]][] = [
  ["Ce mois-ci", () => { const d = new Date(); return [iso(d), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))]; }],
  ["3 prochains mois", () => [iso(new Date()), dansMois(3)]],
  ["6 prochains mois", () => [iso(new Date()), dansMois(6)]],
  ["Toutes les dates", () => [iso(new Date()), ""]],
];
const RACCOURCIS_KM: [string, [number | undefined, number | undefined]][] = [
  ["Toutes", [undefined, undefined]], ["Moins de 15 km", [undefined, 15]], ["15 à 30 km", [15, 30]], ["30 à 60 km", [30, 60]], ["Plus de 60 km", [60, undefined]]];
const RACCOURCIS_DPLUS: [string, [number | undefined, number | undefined]][] = [
  ["Tous", [undefined, undefined]], ["Plat (moins de 300 m)", [undefined, 300]], ["300 à 1 500 m", [300, 1500]], ["Plus de 1 500 m", [1500, undefined]]];
const RACCOURCIS_RAYON: [string, number | undefined][] = [["30 km", 30], ["100 km", 100], ["300 km", 300], ["Toute la France", undefined]];

/** Une question de la recherche : un titre, des champs, des raccourcis. */
function Question({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={S.fort}>{titre}</Text>
      {children}
      {aide ? <Text style={S.petit}>{aide}</Text> : null}
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
  // filtres gardés quand on ouvre une fiche ou change d'onglet, puis qu'on revient
  const [du, setDu] = useEtatGarde("trouver.du", iso(new Date()));
  const [au, setAu] = useEtatGarde("trouver.au", "");
  const [km, setKm] = useEtatGarde<[number | undefined, number | undefined]>("trouver.km", [undefined, undefined]);
  const [dplus, setDplus] = useEtatGarde<[number | undefined, number | undefined]>("trouver.dplus", [undefined, undefined]);
  const [type, setType] = useEtatGarde<Type>("trouver.type", "toutes");
  const [rayonChoisi, setRayon] = useEtatGarde<number | undefined>("trouver.rayon", 100);
  const [combien, setCombien] = useState(20);
  // sans point de départ, on cherche dans toute la France
  const rayon = estInconnu(depart) ? undefined : rayonChoisi;
  const ici = depart.gps ? "toi" : depart.nom.split(",")[0];

  const resultats = useMemo(() => coursesAVenir(AGENDA, depart.position, {
    ...FILTRES_AGENDA, rayonKm: rayon ?? Infinity, moisMax: 36, type, tri: "date", kmMin: km[0], kmMax: km[1],
  }).filter((c) => c.date >= (du || "0") && (!au || c.date <= au)
    && (dplus[0] === undefined && dplus[1] === undefined ? true
      : c.dplus_m === null ? !dplus[0] && c.type === "route"
      : c.dplus_m >= (dplus[0] ?? 0) && c.dplus_m <= (dplus[1] ?? Infinity))),
  [depart.position, du, au, km, dplus, type, rayon]);
  const nomRaccourci = <T,>(liste: [string, T][], v: T) => liste.find(([, x]) => JSON.stringify(x) === JSON.stringify(v))?.[0];

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
      <View style={[S.carte, { marginTop: 0, gap: 26 }]}>
        <Question titre="Quand ?" aide="Les organisateurs publient souvent leur date 3 à 6 mois avant la course.">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.petit}>Du</Text><ChampDate valeur={du} onChange={setDu} etiquette="Courses à partir du" />
            <Text style={S.petit}>au</Text><ChampDate valeur={au} onChange={setAu} etiquette="Courses jusqu'au" min={du} />
          </View>
          <Raccourcis options={RACCOURCIS_QUAND} actif={RACCOURCIS_QUAND.find(([, f]) => { const [d, a] = f(); return d === du && a === au; })?.[0]}
                      onChoisir={(f) => { const [d, a] = f(); setDu(d); setAu(a); }} />
        </Question>
        <Question titre="Quelle distance ?" aide="Une course qui propose plusieurs formats s'affiche si l'un d'eux est dans cette plage.">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.petit}>De</Text><ChampNombre valeur={km[0]} onChange={(v) => setKm([v, km[1]])} unite="km" etiquette="Distance minimale en km" />
            <Text style={S.petit}>à</Text><ChampNombre valeur={km[1]} onChange={(v) => setKm([km[0], v])} unite="km" etiquette="Distance maximale en km" />
          </View>
          <Raccourcis options={RACCOURCIS_KM} actif={nomRaccourci(RACCOURCIS_KM, km)} onChoisir={(v) => setKm(v)} />
        </Question>
        <Question titre="Quel dénivelé ?" aide="Le D+ total de la course, quand l'organisateur l'indique (sinon la course n'apparaît que sans filtre de dénivelé).">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.petit}>De</Text><ChampNombre valeur={dplus[0]} onChange={(v) => setDplus([v, dplus[1]])} unite="m" etiquette="Dénivelé minimal en mètres" />
            <Text style={S.petit}>à</Text><ChampNombre valeur={dplus[1]} onChange={(v) => setDplus([dplus[0], v])} unite="m" etiquette="Dénivelé maximal en mètres" />
          </View>
          <Raccourcis options={RACCOURCIS_DPLUS} actif={nomRaccourci(RACCOURCIS_DPLUS, dplus)} onChoisir={(v) => setDplus(v)} />
        </Question>
        <Question titre="Trail ou route ?">
          <Segments options={TYPES} valeur={type} onChange={setType} />
        </Question>
        <Question titre={`Jusqu'à combien de km de ${estInconnu(depart) ? "chez toi" : ici} ?`}
                  aide={estInconnu(depart) ? "Choisis ton point de départ ci-dessus pour chercher autour de toi ; en attendant, toute la France." : "À vol d'oiseau. Vide : toute la France."}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ChampNombre valeur={rayonChoisi} onChange={setRayon} unite="km" etiquette="Rayon de recherche en km" indice="France" />
          </View>
          <Raccourcis options={RACCOURCIS_RAYON} actif={nomRaccourci(RACCOURCIS_RAYON, rayonChoisi)} onChoisir={(v) => setRayon(v)} />
        </Question>
      </View>

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
