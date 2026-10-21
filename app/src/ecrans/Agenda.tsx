// « Courses à venir » : les courses à pied près de chez moi, d'après les données ouvertes des offices
// de tourisme (DATAtourisme) et des agendas publics (OpenAgenda), en Licence Ouverte. Filtres
// (distance de chez moi, période, trail ou route, format), tri, puis : site officiel, ajout à mes
// courses, ou préparation directe (plan d'entraînement) sur le format choisi.

import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { coursesAVenir, FILTRES_AGENDA, formatsLisibles, type CourseAVenir, type CourseProche, type FiltresAgenda } from "../calcul/agenda.ts";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import type { CourseCible } from "../calcul/plan.ts";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { nombre, Segments } from "../composants/communs.tsx";
import { indiceDe, Plage } from "../composants/Plage.tsx";
import { C, S } from "../theme.ts";
import agendaBrut from "../../assets/data/courses.json";

export const AGENDA = (agendaBrut as { courses: CourseAVenir[]; date_utc: string }).courses;
const MAJ = new Date((agendaBrut as { date_utc: string }).date_utc).toLocaleDateString("fr-FR");

const ECH_RAYON = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, Infinity];
const ECH_KM = [0, 4, 5, 6, 8, 9, 10, 12, 15, 20, 21, 25, 30, 40, 42, 50, 60, 80, 100, 120, 160, Infinity];
const PAR_PAGE = 30;
const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: C.encre } as const;
const jour = (d: string) => new Date(`${d}T12:00:00`);

function LigneCourse({ c, deja, onAjouter, onPreparer }: {
  c: CourseProche; deja: boolean; onAjouter: () => void; onPreparer: (km: number | null) => void;
}) {
  const d = jour(c.date);
  const plusieurs = c.date !== c.fin;
  return (
    <View style={[S.carte, { marginTop: 0, gap: 8, padding: 14 }]}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ width: 52, alignItems: "center", backgroundColor: c.type === "trail" ? C.monteeClair : C.platClair, borderRadius: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.gris, textTransform: "uppercase" }}>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: C.encre }}>{d.getDate()}</Text>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.gris }}>{d.toLocaleDateString("fr-FR", { month: "short" })}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={S.fort} numberOfLines={2}>{c.nom}</Text>
          <Text style={S.petit} numberOfLines={1}>
            {c.commune}{c.cp ? ` (${c.cp.slice(0, 2)})` : ""} · à {kmLisibles(c.distance_m)}{plusieurs ? ` · jusqu'au ${jour(c.fin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
          </Text>
          <Text style={[S.petit, { color: C.encre }]}>
            {c.type === "trail" ? "Trail" : "Route"}{c.distances_km.length ? ` · ${formatsLisibles(c.distances_km)}` : " · formats sur le site officiel"}
            {c.dplus_m ? ` · ${nombre(c.dplus_m)} m D+` : ""}
          </Text>
        </View>
      </View>
      {c.distances_km.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <Text style={S.petit}>Préparer le</Text>
          {c.distances_km.map((km) => (
            <Pressable key={km} onPress={() => onPreparer(km)} accessibilityRole="button" accessibilityLabel={`Préparer le ${km} km de ${c.nom}`}
                       style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: "center", backgroundColor: C.encre }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.fond }}>{String(km).replace(".", ",")} km</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!!c.site && (
          <Pressable onPress={() => Linking.openURL(c.site)} accessibilityRole="link" accessibilityLabel={`Site officiel de ${c.nom}`}
                     style={[S.boutonClair, { flex: 1, minHeight: 40 }]}>
            <Text style={[S.boutonClairTexte, { fontSize: 14 }]}>Site officiel</Text>
          </Pressable>
        )}
        <Pressable onPress={onAjouter} disabled={deja} aria-disabled={deja} accessibilityRole="button"
                   accessibilityLabel={deja ? `${c.nom} est dans mes courses` : `Ajouter ${c.nom} à mes courses`}
                   style={[S.boutonClair, { flex: 1, minHeight: 40, opacity: deja ? 0.5 : 1 }]}>
          <Text style={[S.boutonClairTexte, { fontSize: 14 }]}>{deja ? "Dans mes courses ✓" : "Ajouter à mes courses"}</Text>
        </Pressable>
      </View>
      {!c.distances_km.length && (
        <Pressable onPress={() => onPreparer(null)} accessibilityRole="button" accessibilityLabel={`Préparer ${c.nom}`} hitSlop={6}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee }}>Préparer cette course (je saisis le format)</Text>
        </Pressable>
      )}
      <Text style={[S.petit, { fontSize: 11 }]}>Source : {c.auteur ? `${c.auteur}, via ` : ""}{c.source}{c.maj ? `, mis à jour le ${jour(c.maj).toLocaleDateString("fr-FR")}` : ""}</Text>
    </View>
  );
}

export function EcranAgenda({ depart, localisation, onRecherche, onLocaliser, mesCourses, setMesCourses, onPreparer }: {
  depart: PointDepart; localisation: Localisation; onRecherche: () => void; onLocaliser: () => void;
  mesCourses: CourseInscrite[]; setMesCourses: (c: CourseInscrite[]) => void;
  onPreparer: (cible: CourseCible | null, nom: string) => void;
}) {
  const [f, setF] = useState<FiltresAgenda>(FILTRES_AGENDA);
  const [page, setPage] = useState(1);
  const liste = useMemo(() => coursesAVenir(AGENDA, depart.position, f), [depart.position, f]);
  const maj = (g: Partial<FiltresAgenda>) => { setF({ ...f, ...g }); setPage(1); };
  const bR = indiceDe(ECH_RAYON, f.rayonKm, ECH_RAYON.length - 1);
  const bMin = indiceDe(ECH_KM, f.kmMin, 0);
  const bMax = indiceDe(ECH_KM, f.kmMax, ECH_KM.length - 1);
  const km = (v: number) => (Number.isFinite(v) ? `${v} km` : "160 km et +");
  const ajouter = (c: CourseProche) => setMesCourses([...mesCourses, {
    id: `agenda-${c.id}`, nom: c.nom, date: c.date, lieu: c.commune, distance_km: c.distances_km.at(-1) ?? 0, dplus_m: c.dplus_m ?? 0,
    dossard_eur: 0, logement_eur: 0, lien: c.site, statut: "envisagee", objectif: "", temps: "",
  }]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <BarreDepart titre="Courses autour de" depart={depart} localisation={localisation} onRecherche={onRecherche} onLocaliser={onLocaliser} />

        <View style={{ gap: 16, marginTop: 14 }}>
          <TextInput value={f.texte ?? ""} onChangeText={(texte) => maj({ texte })} placeholder="Nom de la course ou commune" autoCorrect={false}
                     accessibilityLabel="Chercher une course par son nom ou sa commune" style={champ} />
          <Segments options={[["toutes", "Toutes"], ["trail", "Trail"], ["route", "Route"]]} valeur={f.type} onChange={(type) => maj({ type })} />
          <View style={{ gap: 8 }}>
            <Text style={S.fort}>Quand ?</Text>
            <Segments options={[["1", "1 mois"], ["3", "3 mois"], ["6", "6 mois"], ["12", "1 an"]]} valeur={String(f.moisMax)}
                      onChange={(v) => maj({ moisMax: Number(v) })} />
          </View>
          <Plage etiquette="Distance de chez toi" valeurs={ECH_RAYON} unique bas={0} haut={bR}
                 format={(v) => (Number.isFinite(v) ? `${v} km` : "France")} resume={Number.isFinite(f.rayonKm) ? `≤ ${f.rayonKm} km` : "Toute la France"}
                 onChange={(_, h) => maj({ rayonKm: ECH_RAYON[h] })}
                 raccourcis={[{ nom: "20 km", bas: 0, haut: 20 }, { nom: "50 km", bas: 0, haut: 50 }, { nom: "100 km", bas: 0, haut: 100 },
                              { nom: "France", bas: 0, haut: Infinity }]} />
          <Plage etiquette="Format (distance de course)" valeurs={ECH_KM} bas={bMin} haut={bMax} format={km}
                 resume={bMin === 0 && bMax === ECH_KM.length - 1 ? "Tous" : bMin === 0 ? `≤ ${ECH_KM[bMax]} km` : bMax === ECH_KM.length - 1 ? `≥ ${ECH_KM[bMin]} km` : `${ECH_KM[bMin]} à ${ECH_KM[bMax]} km`}
                 onChange={(b, h) => maj({ kmMin: b ? ECH_KM[b] : undefined, kmMax: h < ECH_KM.length - 1 ? ECH_KM[h] : undefined })}
                 raccourcis={[{ nom: "Tous", bas: 0, haut: Infinity }, { nom: "5 km", bas: 4, haut: 6 }, { nom: "10 km", bas: 9, haut: 12 },
                              { nom: "15–20 km", bas: 15, haut: 20 }, { nom: "Semi", bas: 21, haut: 25 }, { nom: "30–40 km", bas: 30, haut: 40 },
                              { nom: "Marathon", bas: 42, haut: 50 }, { nom: "Ultra ≥ 60 km", bas: 60, haut: Infinity }]}
                 aide="Une course est retenue si l'un de ses formats est dans la plage. Sans format connu, elle n'apparaît que sans filtre de format." />
          <View style={{ gap: 8 }}>
            <Text style={S.fort}>Trier par</Text>
            <Segments options={[["date", "Date"], ["distance", "Proximité"], ["longueur", "Plus longue"]]} valeur={f.tri}
                      onChange={(tri) => maj({ tri })} />
          </View>
        </View>

        <Text style={[S.h2, { marginTop: 20 }]} accessibilityRole="header">
          {liste.length ? `${liste.length} course${liste.length > 1 ? "s" : ""}` : "Aucune course avec ces critères"}
        </Text>
        {!liste.length && <Text style={S.petit}>Élargis la distance de chez toi, la période ou le format.</Text>}
        <View style={{ gap: 10, marginTop: 10 }}>
          {liste.slice(0, page * PAR_PAGE).map((c) => (
            <LigneCourse key={c.id} c={c} deja={mesCourses.some((m) => m.id === `agenda-${c.id}` || (m.nom === c.nom && m.date === c.date))}
                         onAjouter={() => ajouter(c)}
                         onPreparer={(k) => onPreparer(k ? { nom: c.distances_km.length > 1 ? `${c.nom} (${String(k).replace(".", ",")} km)` : c.nom,
                                                            distance_km: k, dplus_m: c.dplus_m ?? 0, date: c.date, site: c.site || undefined } : null, c.nom)} />
          ))}
          {liste.length > page * PAR_PAGE && (
            <Pressable onPress={() => setPage(page + 1)} accessibilityRole="button" style={S.boutonClair}>
              <Text style={S.boutonClairTexte}>Voir {Math.min(PAR_PAGE, liste.length - page * PAR_PAGE)} courses de plus</Text>
            </Pressable>
          )}
        </View>

        <Text style={[S.petit, { marginTop: 18 }]}>
          Courses publiées par les offices de tourisme (DATAtourisme) et les agendas publics (OpenAgenda), en Licence Ouverte 2.0 ;
          liste mise à jour le {MAJ}. Distances et D+ lus dans l'annonce : vérifie toujours le site officiel avant de t'inscrire.
          Toutes les courses n'y sont pas : ajoute la tienne dans « Mes courses ».
        </Text>
      </ScrollView>
    </View>
  );
}
