// Course → choisir sa course (par son nom, par son format ou par le GPX), répondre à un mini
// questionnaire, puis suivre un plan d'entraînement semaine par semaine. Chaque séance du plan
// ouvre directement l'endroit où la faire (S'entraîner → Séance ou Sortie).

import { useMemo, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import type { CourseInscrite } from "../calcul/calendrier.ts";
import { chercherCourses, type CourseCatalogue } from "../calcul/catalogue.ts";
import {
  genererPlan, kmEffort, lireFormat, NIVEAUX, semainesAffutage, type CourseCible, type Questionnaire, type Seance,
} from "../calcul/plan.ts";
import { dateValide, joursAvant } from "../calcul/calendrier.ts";
import { Ajusteur, Icone, nombre, Section, Segments } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: C.encre } as const;

export type PresetSortie = NonNullable<Seance["sortie"]>;

/** Choix de la course : recherche par nom (catalogue + mes courses), format écrit, ou GPX. */
export function ChoixCourse({ mesCourses, onChoisir, onImporter, onExemple, etatImport }: {
  mesCourses: CourseInscrite[]; onChoisir: (c: CourseCible) => void; onImporter: () => void; onExemple: () => void;
  etatImport: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("");
  const [date, setDate] = useState("");
  const trouvees = useMemo(() => chercherCourses(q), [q]);
  const miennes = mesCourses.filter((c) => q.trim().length >= 2 && c.nom.toLowerCase().includes(q.trim().toLowerCase()));
  const lu = lireFormat(format);
  const choisirCatalogue = (c: CourseCatalogue) => onChoisir({ nom: c.nom, distance_km: c.distance_km, dplus_m: c.dplus_m, site: c.site });
  return (
    <View style={{ gap: 6 }}>
      <Text style={[S.titre, { marginTop: 8 }]} accessibilityRole="header">Quelle est ta course ?</Text>
      <Text style={S.sousTitre}>L'appli prépare ton plan d'entraînement, tes temps de passage et ta nutrition.</Text>

      <Section titre="Par son nom">
        <TextInput value={q} onChangeText={setQ} placeholder="ex. Templiers, SaintéLyon, Marathon de Paris" autoCorrect={false}
                   accessibilityLabel="Nom de la course" style={champ} />
        {[...miennes.map((c) => ({ cle: `m${c.id}`, titre: c.nom, detail: `Mes courses · ${c.date}`,
                                    choisir: () => onChoisir({ nom: c.nom, distance_km: c.distance_km, dplus_m: c.dplus_m, date: c.date, site: c.lien || undefined }) })),
          ...trouvees.map((c) => ({ cle: c.nom, titre: c.nom, detail: `${c.lieu} · ${c.mois} · ${nombre(c.distance_km, c.distance_km % 1 ? 1 : 0)} km, ${nombre(c.dplus_m)} m D+`,
                                    choisir: () => choisirCatalogue(c) }))].map((x) => (
          <Pressable key={x.cle} onPress={x.choisir} accessibilityRole="button" style={S.ligne}>
            <Icone nom="course" couleur={C.montee} taille={20} />
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>{x.titre}</Text>
              <Text style={S.petit}>{x.detail}</Text>
            </View>
            <Icone nom="fleche" couleur={C.gris} taille={18} />
          </Pressable>
        ))}
        {q.trim().length >= 2 && !trouvees.length && !miennes.length && (
          <Text style={S.petit}>Pas dans notre liste pour l'instant : décris-la ci-dessous (distance et D+).</Text>
        )}
      </Section>

      <Section titre="Ou par son format">
        <TextInput value={format} onChangeText={setFormat} placeholder="ex. trail 30 km 1500 m" autoCorrect={false}
                   accessibilityLabel="Format de la course" style={champ} />
        <TextInput value={date} onChangeText={setDate} placeholder="Date (AAAA-MM-JJ), facultatif" autoCorrect={false}
                   accessibilityLabel="Date de la course" style={champ} />
        <Pressable onPress={() => lu && onChoisir({ nom: format.trim(), ...lu, date: dateValide(date) ? date : undefined })}
                   disabled={!lu} accessibilityRole="button" style={[S.bouton, { opacity: lu ? 1 : 0.45 }]}>
          <Text style={S.boutonTexte}>
            {lu ? `Préparer : ${nombre(lu.distance_km, lu.distance_km % 1 ? 1 : 0)} km${lu.dplus_m ? `, ${nombre(lu.dplus_m)} m D+` : ""}` : "Écris la distance (et le D+)"}
          </Text>
        </Pressable>
      </Section>

      <Section titre="Ou avec le parcours exact">
        <Text style={S.petit}>Le GPX du site de l'organisateur donne le profil découpé et les temps de passage.</Text>
        <Pressable onPress={onImporter} accessibilityRole="button" style={S.boutonClair}>
          <Text style={S.boutonClairTexte}>Importer le GPX</Text>
        </Pressable>
        <Pressable onPress={onExemple} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Voir avec un exemple : l'Alpe d'Huez</Text>
        </Pressable>
        {etatImport}
      </Section>
      <Text style={[S.petit, { marginTop: 12 }]}>
        Formats indicatifs, qui changent d'une édition à l'autre : vérifie toujours sur le site officiel de la course.
      </Text>
    </View>
  );
}

/** Mini questionnaire : niveau, séances par semaine, volume actuel, plus longue sortie, objectif. */
export function FormulaireQuestionnaire({ initial, course, onValider }: {
  initial: Questionnaire | null; course: CourseCible; onValider: (q: Questionnaire, date?: string) => void;
}) {
  const [q, setQ] = useState<Questionnaire>(initial ?? { niveau: "intermediaire", seances: 4, volume_km: 25, plus_longue_km: 12, objectif: "finir" });
  const [date, setDate] = useState(course.date ?? "");
  const maj = (p: Partial<Questionnaire>) => setQ({ ...q, ...p });
  const niveau = NIVEAUX.find((n) => n[0] === q.niveau)!;
  return (
    <View style={[S.carte, { gap: 14 }]}>
      <Text style={S.h2}>Pour un plan à ta mesure</Text>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Ton niveau</Text>
        <Segments options={NIVEAUX.map(([v, n]) => [v, n] as [Questionnaire["niveau"], string])} valeur={q.niveau} onChange={(niveau) => maj({ niveau })} />
        <Text style={S.petit}>{niveau[2]}.</Text>
      </View>
      <Ajusteur etiquette="Séances par semaine" valeur={q.seances} unite="" pas={1} min={3} max={6} onChange={(seances) => maj({ seances })} />
      <Ajusteur etiquette="Km par semaine aujourd'hui" valeur={q.volume_km} unite="km" pas={5} min={0} max={150} onChange={(volume_km) => maj({ volume_km })} />
      <Ajusteur etiquette="Plus longue sortie récente" valeur={q.plus_longue_km} unite="km" pas={1} min={0} max={80} onChange={(plus_longue_km) => maj({ plus_longue_km })} />
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Ton objectif</Text>
        <Segments options={[["finir", "Finir bien"], ["performance", "Un chrono, un classement"]]} valeur={q.objectif}
                  onChange={(objectif) => maj({ objectif })} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Date de la course</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ (sinon plan de 12 semaines)" autoCorrect={false}
                   accessibilityLabel="Date de la course" style={[champ, { backgroundColor: C.fond }]} />
        {date !== "" && !dateValide(date) && <Text style={{ fontSize: 12, color: C.monteeFonce }}>Format : 2027-02-14.</Text>}
      </View>
      {q.plus_longue_km < course.distance_km * 0.25 && course.distance_km > 30 && (
        <Text style={{ fontSize: 13, color: C.monteeFonce }}>
          Ta plus longue sortie est loin de la distance de la course : le plan monte progressivement ; prévois assez de semaines.
        </Text>
      )}
      <Pressable onPress={() => onValider(q, dateValide(date) ? date : undefined)} accessibilityRole="button" style={S.bouton}>
        <Text style={S.boutonTexte}>Créer mon plan</Text>
      </Pressable>
    </View>
  );
}

const COULEUR_PHASE = { "Base": C.platClair, "Spécifique": C.monteeClair, "Affûtage": C.descenteClair, "Course": C.encre } as const;

function heuresMin(min: number) {
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

export function VuePlan({ course, questionnaire, allureMinKm, onModifier, onSeance, onSortie }: {
  course: CourseCible; questionnaire: Questionnaire; allureMinKm: number; onModifier: () => void;
  onSeance: (texte: string) => void; onSortie: (p: PresetSortie) => void;
}) {
  const plan = useMemo(() => genererPlan(course, questionnaire, allureMinKm), [course, questionnaire, allureMinKm]);
  // semaine en cours ouverte d'office
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const enCours = Math.max(0, plan.findLastIndex((s) => s.debut <= aujourdhui));
  const [ouverte, setOuverte] = useState(enCours);
  const commencePlusTard = plan[0].debut > aujourdhui;
  const pointe = Math.max(...plan.map((s) => s.km_effort));
  const longue = Math.max(...plan.flatMap((s) => s.seances.filter((x) => x.type === "longue").map((x) => x.minutes)));
  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      <View style={[S.carte, { marginTop: 0, gap: 6 }]}>
        <Text style={S.h2}>{plan.length} semaines jusqu'au jour J</Text>
        {commencePlusTard && (
          <Text style={[S.fort, { color: C.montee }]}>
            Ton plan commence le {new Date(`${plan[0].debut}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} :
            d'ici là, garde ton rythme habituel.
          </Text>
        )}
        {plan.length < 4 && (
          <Text style={[S.fort, { color: C.montee }]}>Course très proche : plus le temps de construire, on arrive frais.</Text>
        )}
        <Text style={[S.petit, { fontSize: 13, lineHeight: 19, color: C.encre }]}>
          Base (endurance, force en côte) → Spécifique (terrain et efforts de la course) → Affûtage ({semainesAffutage(course)} sem.) → Course.
          Pointe à {pointe} km-effort par semaine, sortie la plus longue {heuresMin(longue)}.
        </Text>
        <Text style={S.petit}>
          Repères : + 10 % par semaine au plus, une semaine allégée sur 4, 80 % du temps en endurance facile, affûtage en réduisant le
          volume de 40 à 60 %. km-effort = km + D+/100. Ce plan ne remplace ni un coach ni un avis médical.
        </Text>
        <Pressable onPress={onModifier} accessibilityRole="button" hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Modifier mes réponses</Text>
        </Pressable>
      </View>
      {plan.map((s, i) => {
        const ouverteIci = ouverte === i;
        const fonce = s.phase === "Course";
        return (
          <View key={s.n} style={{ backgroundColor: C.blanc, borderRadius: 16, overflow: "hidden" }}>
            <Pressable onPress={() => setOuverte(ouverteIci ? -1 : i)} accessibilityRole="button" aria-expanded={ouverteIci}
                       style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
              <View style={{ width: 44, alignItems: "center" }}>
                <Text style={S.petit}>Sem.</Text>
                <Text style={[S.fort, { fontSize: 18 }]}>{s.n}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden",
                                 backgroundColor: COULEUR_PHASE[s.phase], color: fonce ? C.fond : C.encre }}>{s.phase}</Text>
                  {s.allegee && <Text style={S.petit}>semaine allégée</Text>}
                </View>
                <Text style={[S.petit, { marginTop: 2 }]}>
                  À partir du {new Date(`${s.debut}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {" "}· {s.km} km · {nombre(s.dplus_m)} m D+
                </Text>
              </View>
              <Text style={S.fort}>{s.km_effort}</Text>
              <Icone nom="fleche" couleur={C.gris} taille={16} />
            </Pressable>
            {ouverteIci && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
                {s.seances.map((x, k) => (
                  <View key={k} style={{ backgroundColor: C.fond, borderRadius: 12, padding: 10, gap: 4 }}>
                    <Text style={S.fort}>{x.titre}{x.seance ? ` : ${x.seance}` : ""}</Text>
                    <Text style={S.petit}>{x.detail} · ≈ {heuresMin(x.minutes)}</Text>
                    {x.seance && (
                      <Pressable onPress={() => onSeance(x.seance!)} accessibilityRole="button" hitSlop={6}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee }}>Trouver où la faire →</Text>
                      </Pressable>
                    )}
                    {!x.seance && x.sortie && (
                      <Pressable onPress={() => onSortie(x.sortie!)} accessibilityRole="button" hitSlop={6}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee }}>Préparer cette sortie ({x.sortie.km} km) →</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** En-tête de la course choisie : chiffres, compte à rebours, site officiel. */
export function EnTeteCourse({ course, onChanger }: { course: CourseCible; onChanger: () => void }) {
  const j = course.date ? joursAvant(course.date) : null;
  return (
    <View style={{ marginTop: 8, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[S.surtitre, { flex: 1 }]}>Ma course{j !== null && j >= 0 ? ` · J-${j}` : ""}</Text>
        <Pressable onPress={onChanger} accessibilityRole="button" hitSlop={10}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Changer de course</Text>
        </Pressable>
      </View>
      <Text style={S.titre} accessibilityRole="header">{course.nom}</Text>
      <Text style={S.sousTitre}>
        {nombre(course.distance_km, course.distance_km % 1 ? 1 : 0)} km · {nombre(course.dplus_m)} m D+ · {nombre(kmEffort(course.distance_km, course.dplus_m))} km-effort
        {course.date ? ` · ${new Date(`${course.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}
      </Text>
      {course.site && (
        <Pressable onPress={() => Linking.openURL(course.site!)} accessibilityRole="link" hitSlop={6}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Site officiel : dates et inscriptions →</Text>
        </Pressable>
      )}
    </View>
  );
}
