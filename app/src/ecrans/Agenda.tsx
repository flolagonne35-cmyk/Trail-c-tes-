// « Courses à venir » : les courses à pied près de chez moi, d'après les données ouvertes des offices
// de tourisme (DATAtourisme) et des agendas publics (OpenAgenda), en Licence Ouverte. Filtres
// (distance de chez moi, période, trail ou route, format), tri, puis : site officiel, ajout à mes
// courses, ou préparation directe (plan d'entraînement) sur le format choisi.

import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  coursesAVenir, departementDe, FILTRES_AGENDA, formatsLisibles, grouperCourses, nomZone, RAYON_VILLE_KM,
  type CourseAVenir, type CourseProche, type FiltresAgenda, type Zone,
} from "../calcul/agenda.ts";
import { departementPres, indexCommunes, normaliser } from "../calcul/communes.ts";
import { DEPARTEMENTS, REGIONS, regionDe } from "../calcul/regions.ts";
import { centreDe, zoomAjuste } from "../calcul/tuiles.ts";
import { Carte } from "../composants/Carte.tsx";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import type { CourseCible } from "../calcul/plan.ts";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
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

function LigneCourse({ c, numero, deja, onAjouter, onPreparer }: {
  c: CourseProche; numero?: number; deja: boolean; onAjouter: () => void; onPreparer: (km: number | null) => void;
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
          <Text style={S.fort} numberOfLines={2}>{numero ? `${numero}. ` : ""}{c.nom}</Text>
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

// département de chaque course (code postal, sinon commune la plus proche), calculé une fois
const DEPS = new Map<string, string>();
function depDe(c: CourseAVenir): string {
  let d = DEPS.get(c.id);
  if (d === undefined) {
    d = departementDe(c, (p) => departementPres(indexCommunes(), p));
    DEPS.set(c.id, d);
  }
  return d;
}

const CARTE_MAX = 40;
const couleurType = (c: CourseAVenir) => (c.type === "trail" ? C.montee : C.plat);

/** Choix d'un département : on tape un nom ou un numéro ; ceux de la région du lieu sont proposés d'abord. */
function ChoixDepartement({ actuel, depLieu, onChoisir }: { actuel?: string; depLieu: string; onChoisir: (code: string) => void }) {
  const [q, setQ] = useState("");
  const region = REGIONS.find((r) => r.departements.includes(depLieu));
  const n = normaliser(q);
  const codes = n
    ? Object.keys(DEPARTEMENTS).filter((d) => d.toLowerCase().startsWith(n) || normaliser(DEPARTEMENTS[d]).includes(n)).slice(0, 12)
    : [...(region?.departements ?? []), ...Object.keys(DEPARTEMENTS).filter((d) => !region?.departements.includes(d))].slice(0, 8);
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Nom ou numéro (ex. Finistère, 29)" autoCorrect={false}
                 accessibilityLabel="Chercher un département" style={champ} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {codes.map((d) => {
          const actif = d === actuel;
          return (
            <Pressable key={d} onPress={() => onChoisir(d)} accessibilityRole="button" aria-selected={actif}
                       accessibilityLabel={`Département ${DEPARTEMENTS[d]} (${d})`}
                       style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{DEPARTEMENTS[d]} ({d})</Text>
            </Pressable>
          );
        })}
        {!codes.length && <Text style={S.petit}>Aucun département ne correspond.</Text>}
      </View>
    </View>
  );
}

export function EcranAgenda({ depart, localisation, onRecherche, onLocaliser, mesCourses, setMesCourses, onPreparer }: {
  depart: PointDepart; localisation: Localisation; onRecherche: () => void; onLocaliser: () => void;
  mesCourses: CourseInscrite[]; setMesCourses: (c: CourseInscrite[]) => void;
  onPreparer: (cible: CourseCible | null, nom: string) => void;
}) {
  const [f, setF] = useState<FiltresAgenda>({ ...FILTRES_AGENDA, rayonKm: 30, moisMax: 12 });
  const [zone, setZone] = useState<Zone>({ mode: "autour" });
  const [vue, setVue] = useState<"liste" | "carte">("liste");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [choisie, setChoisie] = useState<string | null>(null);
  const maj = (g: Partial<FiltresAgenda>) => { setF({ ...f, ...g }); setPages({}); setChoisie(null); };
  const changerZone = (z: Zone) => { setZone(z); setPages({}); setChoisie(null); };

  // département du lieu : celui de la ville choisie (« 35000 · département 35 »), sinon la commune la plus proche
  const depLieu = useMemo(() => depart.detail.match(/département (\w+)/)?.[1] ?? departementPres(indexCommunes(), depart.position),
                          [depart]);
  const lieu = { position: depart.position, nom: depart.nom, dep: depLieu };
  const groupes = useMemo(() => grouperCourses(AGENDA, zone, lieu, f, depDe), [zone, depart, depLieu, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = groupes.reduce((n, g) => n + g.courses.length, 0);
  // nombre de courses par région avec les filtres actuels, pour le choix de la région
  const parRegion = useMemo(() => {
    const n: Record<string, number> = {};
    for (const c of coursesAVenir(AGENDA, depart.position, { ...f, rayonKm: Infinity })) {
      const r = regionDe(depDe(c));
      n[r] = (n[r] ?? 0) + 1;
    }
    return n;
  }, [f, depart.position]);
  const numeros = new Map(groupes.flatMap((g) => g.courses).map((c, i) => [c.id, i + 1]));

  const bR = indiceDe(ECH_RAYON, f.rayonKm, ECH_RAYON.length - 1);
  const bMin = indiceDe(ECH_KM, f.kmMin, 0);
  const bMax = indiceDe(ECH_KM, f.kmMax, ECH_KM.length - 1);
  const km = (v: number) => (Number.isFinite(v) ? `${v} km` : "160 km et +");
  const resumeFormat = bMin === 0 && bMax === ECH_KM.length - 1 ? "tous formats" : bMin === 0 ? `≤ ${ECH_KM[bMax]} km` : bMax === ECH_KM.length - 1 ? `≥ ${ECH_KM[bMin]} km` : `${ECH_KM[bMin]} à ${ECH_KM[bMax]} km`;
  const resumeFiltres = [f.type === "toutes" ? "trail et route" : f.type, f.moisMax === 12 ? "1 an" : `${f.moisMax} mois`, resumeFormat,
                         { date: "par date", distance: "par proximité", longueur: "plus longues d'abord" }[f.tri], f.texte ? `« ${f.texte} »` : ""]
    .filter(Boolean).join(" · ");
  const nbFiltres = Number(f.type !== "toutes") + Number(f.moisMax !== 12) + Number(resumeFormat !== "tous formats") + Number(f.tri !== "date") + Number(!!f.texte);

  const ajouter = (c: CourseProche) => setMesCourses([...mesCourses, {
    id: `agenda-${c.id}`, nom: c.nom, date: c.date, lieu: c.commune, distance_km: c.distances_km.at(-1) ?? 0, dplus_m: c.dplus_m ?? 0,
    dossard_eur: 0, logement_eur: 0, lien: c.site, statut: "envisagee", objectif: "", temps: "",
  }]);
  const ligne = (c: CourseProche) => (
    <LigneCourse key={c.id} c={c} numero={numeros.get(c.id)}
                 deja={mesCourses.some((m) => m.id === `agenda-${c.id}` || (m.nom === c.nom && m.date === c.date))}
                 onAjouter={() => ajouter(c)}
                 onPreparer={(k) => onPreparer(k ? { nom: c.distances_km.length > 1 ? `${c.nom} (${String(k).replace(".", ",")} km)` : c.nom,
                                                    distance_km: k, dplus_m: c.dplus_m ?? 0, date: c.date, site: c.site || undefined } : null, c.nom)} />
  );

  const surCarte = groupes.flatMap((g) => g.courses).slice(0, CARTE_MAX);
  const pointsCarte = surCarte.map((c) => ({ lat: c.lat, lon: c.lon }));
  const centreCarte = zone.mode === "autour" || !pointsCarte.length ? depart.position : centreDe(pointsCarte);
  const selection = surCarte.find((c) => c.id === choisie);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={[S.titre, { marginTop: 8 }]} accessibilityRole="header">Où veux-tu courir ?</Text>
        <View style={{ marginTop: 10 }}>
          <Segments options={[["autour", "Ville"], ["departement", "Département"], ["region", "Région"]]} valeur={zone.mode}
                    onChange={(m) => changerZone(m === "autour" ? { mode: "autour" }
                      : m === "departement" ? { mode: "departement", code: depLieu || "35" }
                      : { mode: "region", code: regionDe(depLieu) || "BRE" })} />
        </View>

        {zone.mode === "autour" && (
          <View style={{ gap: 12 }}>
            <BarreDepart titre="Autour de (ville, adresse ou ta position)" depart={depart} localisation={localisation}
                         onRecherche={onRecherche} onLocaliser={onLocaliser} />
            <Plage etiquette="Jusqu'à" valeurs={ECH_RAYON} unique bas={0} haut={bR}
                   format={(v) => (Number.isFinite(v) ? `${v} km` : "France")} resume={Number.isFinite(f.rayonKm) ? `${f.rayonKm} km` : "Toute la France"}
                   onChange={(_, h) => maj({ rayonKm: ECH_RAYON[h] })}
                   raccourcis={[{ nom: "15 km", bas: 0, haut: 15 }, { nom: "30 km", bas: 0, haut: 30 }, { nom: "50 km", bas: 0, haut: 50 },
                                { nom: "100 km", bas: 0, haut: 100 }]}
                   aide={`Les courses de la ville (moins de ${RAYON_VILLE_KM} km du centre) d'abord, puis celles des alentours, puis le reste de la région.`} />
          </View>
        )}
        {zone.mode === "departement" && (
          <View style={{ marginTop: 12 }}>
            <ChoixDepartement actuel={zone.code} depLieu={depLieu} onChoisir={(code) => changerZone({ mode: "departement", code })} />
          </View>
        )}
        {zone.mode === "region" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {REGIONS.map((r) => {
              const actif = r.code === zone.code;
              return (
                <Pressable key={r.code} onPress={() => changerZone({ mode: "region", code: r.code })} accessibilityRole="button" aria-selected={actif}
                           accessibilityLabel={`Région ${r.nom}, ${parRegion[r.code] ?? 0} courses`}
                           style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                    backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{r.nom} · {parRegion[r.code] ?? 0}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* filtres repliés en une ligne : les résultats restent en haut de l'écran */}
        <View style={{ marginTop: 14, backgroundColor: C.blanc, borderRadius: 14, padding: 12, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[S.petit, { flex: 1, color: C.encre }]} numberOfLines={2}>{resumeFiltres}</Text>
            <Pressable onPress={() => setFiltresOuverts(!filtresOuverts)} accessibilityRole="button" aria-expanded={filtresOuverts}
                       accessibilityLabel={filtresOuverts ? "Fermer les filtres" : `Filtres : période, trail ou route, format, tri${nbFiltres ? `, ${nbFiltres} actifs` : ""}`}
                       style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.sable }}>
              <Icone nom="filtres" couleur={C.encre} taille={16} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.encre }}>{filtresOuverts ? "Fermer" : `Filtres${nbFiltres ? ` (${nbFiltres})` : ""}`}</Text>
            </Pressable>
          </View>
          {filtresOuverts && (
            <View style={{ gap: 16 }}>
              <TextInput value={f.texte ?? ""} onChangeText={(texte) => maj({ texte })} placeholder="Nom de la course ou commune" autoCorrect={false}
                         accessibilityLabel="Chercher une course par son nom ou sa commune" style={[champ, { backgroundColor: C.fond }]} />
              <Segments options={[["toutes", "Trail et route"], ["trail", "Trail"], ["route", "Route"]]} valeur={f.type} onChange={(type) => maj({ type })} />
              <View style={{ gap: 8 }}>
                <Text style={S.fort}>Quand ?</Text>
                <Segments options={[["1", "1 mois"], ["3", "3 mois"], ["6", "6 mois"], ["12", "1 an"]]} valeur={String(f.moisMax)}
                          onChange={(v) => maj({ moisMax: Number(v) })} />
              </View>
              <Plage etiquette="Format (distance de course)" valeurs={ECH_KM} bas={bMin} haut={bMax} format={km}
                     resume={resumeFormat === "tous formats" ? "Tous" : resumeFormat}
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
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 }}>
          <Text style={[S.h2, { flex: 1 }]} accessibilityRole="header">
            {total ? `${total} course${total > 1 ? "s" : ""} · ${nomZone(zone, depart)}` : `Aucune course · ${nomZone(zone, depart)}`}
          </Text>
        </View>
        {!total && (
          <Text style={[S.petit, { marginTop: 6 }]}>
            {zone.mode === "autour" ? "Élargis la distance, choisis une région, ou ouvre les filtres (période, format)." : "Choisis une autre zone ou ouvre les filtres (période, format)."}
          </Text>
        )}
        {total > 0 && (
          <View style={{ marginTop: 10 }}>
            <Segments options={[["liste", "Liste"], ["carte", "Carte"]]} valeur={vue} onChange={setVue} />
          </View>
        )}

        {vue === "carte" && total > 0 ? (
          <View style={{ gap: 10, marginTop: 12 }}>
            <Carte hauteur={380} centre={centreCarte} position={zone.mode === "autour" ? depart.position : undefined}
                   rayonM={zone.mode === "autour" && Number.isFinite(f.rayonKm) ? f.rayonKm * 1000 : undefined}
                   zoom={zoomAjuste([...(zone.mode === "autour" ? [depart.position] : []), ...pointsCarte], 360, 380, 6, 13)}
                   cle={`${zone.mode}-${JSON.stringify(zone)}-${surCarte.map((c) => c.id).join(",")}`}
                   marqueurs={surCarte.map((c) => ({
                     id: c.id, position: { lat: c.lat, lon: c.lon }, texte: String(numeros.get(c.id)), couleur: c.id === choisie ? C.encre : couleurType(c),
                     label: `${numeros.get(c.id)}. ${c.nom}, ${c.commune}, le ${jour(c.date).toLocaleDateString("fr-FR")}`,
                     onPress: () => setChoisie(c.id),
                   }))} />
            <Text style={S.petit}>
              Orange : trail · gris : route. {total > CARTE_MAX ? `Les ${CARTE_MAX} premières de la liste. ` : ""}Touche un numéro pour voir la course.
            </Text>
            {selection && ligne(selection)}
          </View>
        ) : (
          groupes.map((g) => {
            const n = (pages[g.titre] ?? 1) * PAR_PAGE;
            return (
              <View key={g.titre} style={{ gap: 10, marginTop: 16 }}>
                <Text style={[S.surtitre, { fontSize: 13 }]} accessibilityRole="header">{g.titre} · {g.courses.length}</Text>
                {g.courses.slice(0, n).map(ligne)}
                {g.courses.length > n && (
                  <Pressable onPress={() => setPages({ ...pages, [g.titre]: (pages[g.titre] ?? 1) + 1 })} accessibilityRole="button" style={S.boutonClair}>
                    <Text style={S.boutonClairTexte}>Voir {Math.min(PAR_PAGE, g.courses.length - n)} courses de plus</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        <Text style={[S.petit, { marginTop: 18 }]}>
          Courses publiées par les offices de tourisme (DATAtourisme) et les agendas publics (OpenAgenda), en Licence Ouverte 2.0 ;
          liste mise à jour le {MAJ}. Distances et D+ lus dans l'annonce : vérifie toujours le site officiel avant de t'inscrire.
          Toutes les courses n'y sont pas : ajoute la tienne dans « Mes courses ».
        </Text>
      </ScrollView>
    </View>
  );
}
