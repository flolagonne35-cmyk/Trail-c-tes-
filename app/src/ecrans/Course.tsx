// Onglet « Course » : choisir sa course (nom, format ou GPX), puis quatre vues : Plan (entraînement
// semaine par semaine, d'après un mini questionnaire), Profil (segments), Passages (temps estimés),
// Prépa (où s'entraîner près de chez soi). La nutrition de la course est dans l'onglet Nutrition.

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { heuresLisibles, lireObjectif, tempsDePassage } from "../calcul/nutrition.ts";
import { kmLisibles, type Cote, type CoteProche } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { tempsPrevu, type Modele } from "../calcul/allure.ts";
import { analyserGpx } from "../calcul/parcours.ts";
import { passagesCles } from "../calcul/seances.ts";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import type { CourseCible, Questionnaire } from "../calcul/plan.ts";
import { ChoixCourse, EnTeteCourse, FormulaireQuestionnaire, VuePlan, type PresetSortie } from "./Plan.tsx";
import type { Parcours } from "../calcul/profil.ts";
import { Icone, nombre, Section, Segments } from "../composants/communs.tsx";
import { ProfilParcours } from "../composants/graphiques.tsx";
import { choisirGpx } from "../fichiers.ts";
import { C, COULEUR_TYPE, S } from "../theme.ts";

type Vue = "plan" | "parcours" | "passages" | "prepa";

const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 16,
                color: C.encre } as const;

function useImport(onParcours: (p: Parcours) => void) {
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  async function importer() {
    setErreur(null);
    try {
      const fichier = await choisirGpx();
      if (!fichier) return;
      setEtat("Lecture de la trace…");
      onParcours(await analyserGpx(fichier.texte, {
        nom: fichier.nom,
        onProgres: (fait, total) => setEtat(`Altitudes IGN : ${Math.round((100 * fait) / total)} %`),
      }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEtat(null);
    }
  }
  return { etat, erreur, importer };
}

function EtatImport({ etat, erreur }: { etat: string | null; erreur: string | null }) {
  return (
    <>
      {etat && (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 }}>
          <ActivityIndicator color={C.encre} /><Text style={S.petit}>{etat}</Text>
        </View>
      )}
      {erreur && <Text style={{ color: C.monteeFonce, marginTop: 10 }} accessibilityRole="alert">{erreur}</Text>}
    </>
  );
}

function VueParcours({ parcours }: { parcours: Parcours }) {
  const [tout, setTout] = useState(false);
  const segments = tout ? parcours.segments : parcours.segments.slice(0, 6);
  return (
    <>
      <View style={S.carte}><ProfilParcours parcours={parcours} /></View>
      <Section titre={`${parcours.segments.length} segment${parcours.segments.length > 1 ? "s" : ""}`}>
        <View style={{ gap: 8 }}>
          {segments.map((s) => {
            const couleur = COULEUR_TYPE[s.type];
            const signe = s.type === "descente" ? "−" : "+";
            const d = s.type === "descente" ? s.dmoins_m : s.dplus_m;
            return (
              <View key={s.n} style={S.ligne} accessible
                    accessibilityLabel={`${s.type} du km ${s.km_debut} au km ${s.km_fin}, ${signe}${d} mètres, ${s.pente_moy_pct} %, ${s.difficulte}`}>
                <Text style={{ width: 78, textAlign: "center", fontSize: 12, fontWeight: "700", paddingVertical: 5, borderRadius: 8,
                               overflow: "hidden", backgroundColor: couleur.fond, color: couleur.texte }}>
                  {s.type[0].toUpperCase() + s.type.slice(1)}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: C.encre }}>km {nombre(s.km_debut, 1)} – {nombre(s.km_fin, 1)}</Text>
                  <Text style={S.petit} numberOfLines={1}>{s.description} · {s.difficulte}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={S.fort}>{signe}{nombre(d)} m</Text>
                  <Text style={S.petit}>{nombre(Math.abs(s.pente_moy_pct), 1)} % moy.</Text>
                </View>
              </View>
            );
          })}
          {parcours.segments.length > 6 && (
            <Pressable onPress={() => setTout(!tout)} accessibilityRole="button" style={S.boutonClair}>
              <Text style={S.boutonClairTexte}>{tout ? "Moins de segments" : `Voir les ${parcours.segments.length} segments`}</Text>
            </Pressable>
          )}
        </View>
      </Section>
    </>
  );
}

function VuePassages({ parcours, heures }: { parcours: Parcours; heures: number }) {
  const pasKm = parcours.distance_km <= 15 ? 1 : 5;
  const passages = useMemo(() => tempsDePassage(parcours, heures, pasKm), [parcours, heures, pasKm]);
  return (
    <Section titre={`Tous les ${pasKm} km`}>
      <Text style={S.petit}>Allure ajustée à la pente de chaque tronçon (coût énergétique de la course, Minetti 2002), recalée sur ton objectif.</Text>
      <View style={[S.carte, { marginTop: 0, paddingVertical: 4 }]}>
        <View style={{ flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.aire }}>
          <Text style={[S.petit, { width: 80 }]}>Borne</Text>
          <Text style={[S.petit, { flex: 1, textAlign: "center" }]}>Passage</Text>
          <Text style={[S.petit, { width: 90, textAlign: "right" }]}>Allure</Text>
        </View>
        {passages.map((p, i) => (
          <View key={p.km} style={{ flexDirection: "row", paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: C.aire }}>
            <Text style={[S.fort, { width: 80 }]}>km {nombre(p.km, p.km % 1 ? 1 : 0)}</Text>
            <Text style={[S.fort, { flex: 1, textAlign: "center" }]}>{p.passage}</Text>
            <Text style={[S.petit, { width: 90, textAlign: "right", color: C.encre }]}>{p.allure} /km</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function VuePrepa({ parcours, cotes, position, nomDepart, onChoisir }: {
  parcours: Parcours; cotes: Cote[]; position: Position; nomDepart: string; onChoisir: (c: CoteProche, rang: number) => void;
}) {
  const equivalents = useMemo(() => passagesCles(parcours.segments, cotes, position), [parcours, cotes, position]);
  return (
    <Section titre="S'entraîner près de chez toi">
      <Text style={S.petit}>
        Les plus grosses montées et descentes de la course, et pour chacune la côte proche {nomDepart === "Ma position" ? "de toi" : `de ${nomDepart}`} la
        plus semblable en pente. Les répétitions redonnent le dénivelé du passage, réparties en séances de 15 montées au plus.
      </Text>
      {equivalents.length === 0 && (
        <Text style={[S.petit, { color: C.encre }]}>Aucun passage de plus de 50 m de dénivelé, ou aucune côte calculée à moins de 25 km.</Text>
      )}
      {equivalents.map((e, i) => {
        const s = e.segment;
        const descente = e.sens === "descente";
        const couleur = COULEUR_TYPE[s.type];
        return (
          <View key={s.n} style={[S.carte, { marginTop: 0, gap: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: "hidden",
                             backgroundColor: couleur.fond, color: couleur.texte }}>{descente ? "Descente" : "Montée"}</Text>
              <Text style={[S.fort, { flex: 1 }]}>km {nombre(s.km_debut, 1)} – {nombre(s.km_fin, 1)}</Text>
              <Text style={S.fort}>{descente ? "−" : "+"}{nombre(descente ? s.dmoins_m : s.dplus_m)} m</Text>
            </View>
            <Text style={S.petit}>{nombre(s.distance_km, 1)} km à {nombre(s.pente_moy_pct, 1)} % de moyenne, max {nombre(Math.abs(s.pente_max_pct))} %</Text>
            <Pressable onPress={() => onChoisir(e.cote, i + 1)} accessibilityRole="button"
                       style={{ backgroundColor: C.fond, borderRadius: 12, padding: 12, gap: 2 }}>
              <Text style={S.fort}>
                {e.repetitions > 15 ? `${Math.ceil(e.repetitions / 15)} séances de ${Math.ceil(e.repetitions / Math.ceil(e.repetitions / 15))}` : e.repetitions}
                {" "}× {nombre(Math.round(e.cote.longueur_m / 10) * 10)} m à {descente ? "−" : ""}{nombre(e.cote.pente_moy_pct, 1)} %
              </Text>
              {e.repetitions > 15 && (
                <Text style={S.petit}>{e.repetitions} montées au total pour {nombre(descente ? s.dmoins_m : s.dplus_m)} m : un bloc par semaine dans les 6 semaines avant la course.</Text>
              )}
              <Text style={S.petit} numberOfLines={1}>{e.cote.adresse || e.cote.nom || e.cote.type_voie} · à {kmLisibles(e.cote.distance_m)}</Text>
              {e.ecartPente > 2 && (
                <Text style={{ fontSize: 12, color: C.monteeFonce }}>Pas de pente aussi forte près d'ici : la plus proche est retenue.</Text>
              )}
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee, marginTop: 4 }}>Voir {descente ? "la descente" : "la côte"} →</Text>
            </Pressable>
          </View>
        );
      })}
    </Section>
  );
}

function SansGpx({ texte, onImporter }: { texte: string; onImporter: () => void }) {
  return (
    <View style={[S.carte, { gap: 10 }]}>
      <Text style={[S.petit, { fontSize: 14, lineHeight: 20, color: C.encre }]}>{texte}</Text>
      <Pressable onPress={onImporter} accessibilityRole="button" style={S.boutonClair}>
        <Text style={S.boutonClairTexte}>Importer le GPX de la course</Text>
      </Pressable>
    </View>
  );
}

export function EcranCourse({ parcours, onParcours, onExemple, objectif, setObjectif, onNutrition,
                              cotes, position, nomDepart, onChoisir, modele, cible, setCible, questionnaire, setQuestionnaire,
                              mesCourses, onSeance, onSortie, allurePlat }: {
  parcours: Parcours | null; onParcours: (p: Parcours | null) => void; onExemple: () => void;
  objectif: string; setObjectif: (v: string) => void; onNutrition: () => void;
  cotes: Cote[]; position: Position; nomDepart: string; onChoisir: (c: CoteProche, rang: number) => void;
  modele: Modele | null; cible: CourseCible | null; setCible: (c: CourseCible | null) => void;
  questionnaire: Questionnaire | null; setQuestionnaire: (q: Questionnaire | null) => void; mesCourses: CourseInscrite[];
  onSeance: (texte: string) => void; onSortie: (p: PresetSortie) => void; allurePlat: number;
}) {
  const [vue, setVue] = useState<Vue>("plan");
  const [edition, setEdition] = useState(false);
  const { etat, erreur, importer } = useImport((p) => { onParcours(p); });
  const course: CourseCible | null = cible
    ? (parcours ? { ...cible, distance_km: Math.round(parcours.distance_km * 10) / 10, dplus_m: Math.round(parcours.dplus_m) } : cible)
    : parcours ? { nom: parcours.nom, distance_km: Math.round(parcours.distance_km * 10) / 10, dplus_m: Math.round(parcours.dplus_m) } : null;
  const etatImport = <EtatImport etat={etat} erreur={erreur} />;
  if (!course) {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <ChoixCourse mesCourses={mesCourses} onChoisir={(c) => { setCible(c); setVue("plan"); }} onImporter={importer}
                     onExemple={onExemple} etatImport={etatImport} />
      </ScrollView>
    );
  }

  const heures = lireObjectif(objectif);
  const objectifOk = Number.isFinite(heures) && heures > 0;
  const allureMinKm = modele ? (modele.secondesParMetre(0) * 1000) / 60 : allurePlat;
  const changer = () => { setCible(null); onParcours(null); setQuestionnaire(null); };
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <EnTeteCourse course={course} onChanger={changer} />
      {etatImport}

      <View style={{ marginTop: 14 }}>
        <Segments options={[["plan", "Plan"], ["parcours", "Profil"], ["passages", "Passages"], ["prepa", "Prépa"]]}
                  valeur={vue} onChange={setVue} />
      </View>
      <Pressable onPress={onNutrition} accessibilityRole="button" style={[S.ligne, { marginTop: 10 }]}>
        <Icone nom="nutrition" couleur={C.montee} />
        <View style={{ flex: 1 }}>
          <Text style={S.fort}>Nutrition de cette course</Text>
          <Text style={S.petit}>Glucides, eau et sel entre chaque ravitaillement</Text>
        </View>
        <Icone nom="fleche" couleur={C.gris} taille={18} />
      </Pressable>

      {vue === "plan" && (questionnaire && !edition ? (
        <VuePlan course={course} questionnaire={questionnaire} allureMinKm={allureMinKm} onModifier={() => setEdition(true)}
                 onSeance={onSeance} onSortie={onSortie} />
      ) : (
        <FormulaireQuestionnaire initial={questionnaire} course={course}
                                 onValider={(q, date) => { setQuestionnaire(q); if (date) setCible({ ...course, date }); setEdition(false); }} />
      ))}

      {vue !== "plan" && !parcours && (
        <SansGpx onImporter={importer}
                 texte={vue === "parcours" ? "Le profil découpé (montées, descentes, plats) demande le tracé exact de la course."
                   : vue === "passages" ? "Les temps de passage se calculent sur le tracé exact, pente par pente."
                   : "Les passages-clés et leurs côtes équivalentes près de chez toi viennent du tracé exact."} />
      )}
      {vue !== "plan" && parcours && (
        <>
          <Text style={[S.petit, { marginTop: 10 }]}>{parcours.source_altitudes.startsWith("IGN") ? "Altitudes IGN" : parcours.source_altitudes}
            {" "}· D− {nombre(parcours.dmoins_m)} m · altitude max {nombre(parcours.alt_max_m)} m</Text>
          {vue === "passages" && (
            <>
              <View style={[S.carte, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
                <Icone nom="chrono" couleur={C.montee} />
                <Text style={[S.fort, { flex: 1 }]}>Objectif de temps</Text>
                <TextInput value={objectif} onChangeText={setObjectif} placeholder="ex. 5h40" autoCapitalize="none"
                           accessibilityLabel="Objectif de temps"
                           style={[champ, { width: 110, textAlign: "center", backgroundColor: C.fond, fontWeight: "700" }]} />
              </View>
              {!objectifOk && <Text style={{ color: C.monteeFonce, marginTop: 6 }}>Format attendu : 38h, 5h40 ou 90min.</Text>}
              {modele ? (() => {
                const prevu = tempsPrevu(parcours, modele);
                const texteObjectif = `${Math.floor(prevu)}h${String(Math.round((prevu % 1) * 60)).padStart(2, "0")}`;
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <Text style={[S.petit, { flex: 1 }]}>
                      À ton allure (apprise sur {nombre(modele.metres / 1000, 0)} km de tes sorties, selon la pente) : <Text style={S.fort}>{heuresLisibles(prevu)}</Text>,
                      hors fatigue des très longues distances.
                    </Text>
                    {texteObjectif !== objectif && (
                      <Pressable onPress={() => setObjectif(texteObjectif)} accessibilityRole="button" style={[S.boutonClair, { minHeight: 40 }]}>
                        <Text style={S.boutonClairTexte}>Utiliser</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })() : (
                <Text style={[S.petit, { marginTop: 8 }]}>
                  Ajoute quelques sorties GPX (Profil) : l'appli apprendra ton allure selon la pente et proposera un objectif à ta mesure.
                </Text>
              )}
              {objectifOk && <VuePassages parcours={parcours} heures={heures} />}
            </>
          )}
          {vue === "parcours" && <VueParcours parcours={parcours} />}
          {vue === "prepa" && <VuePrepa parcours={parcours} cotes={cotes} position={position} nomDepart={nomDepart} onChoisir={onChoisir} />}
        </>
      )}
    </ScrollView>
  );
}
