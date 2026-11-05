// Programme → Mon programme (et Courses → Ma course) : choisir sa course (par son nom, par son format ou par le GPX), répondre à un mini
// questionnaire, puis suivre un plan d'entraînement semaine par semaine. Chaque séance du plan
// ouvre directement l'endroit où la faire (Programme → Séance ou Sorties).

import { useMemo, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import { coursesAVenir, FILTRES_AGENDA, formatsLisibles } from "../calcul/agenda.ts";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import { chercherCourses, type CourseCatalogue } from "../calcul/catalogue.ts";
import {
  allures, allureTexte, genererPlan, JOURS, kmEffort, lireFormat, meilleurVdot, NIVEAUX, RECORDS, semainesAffutage,
  type CleRecord, type CourseCible, type Questionnaire, type Seance,
} from "../calcul/plan.ts";
import { lireTemps, tempsLisible } from "../calcul/allures.ts";
import { dateValide, joursAvant } from "../calcul/calendrier.ts";
import { Ajusteur, Icone, nombre, Section, Segments } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";
import { AGENDA } from "./Agenda.tsx";

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
  // courses à venir en France (offices de tourisme, agendas publics) dont le nom correspond
  const aVenir = useMemo(() => (q.trim().length >= 3
    ? coursesAVenir(AGENDA, { lat: 46.6, lon: 2.4 }, { ...FILTRES_AGENDA, rayonKm: Infinity, moisMax: 12, texte: q }).slice(0, 5) : []), [q]);
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
                                    choisir: () => choisirCatalogue(c) })),
          ...aVenir.map((c) => ({ cle: c.id, titre: c.nom,
                                  detail: `${c.commune} · ${new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${c.distances_km.length ? ` · ${formatsLisibles(c.distances_km)}` : ""}`,
                                  // sans format connu : on pré-remplit la date, il reste à écrire la distance (et le D+)
                                  choisir: () => (c.distances_km.length
                                    ? onChoisir({ nom: c.nom, distance_km: c.distances_km.at(-1)!, dplus_m: c.dplus_m ?? 0, date: c.date, site: c.site || undefined })
                                    : (setFormat(`${c.type} `), setDate(c.date))) }))].map((x) => (
          <Pressable key={x.cle} onPress={x.choisir} accessibilityRole="button" style={S.ligne}>
            <Icone nom="course" couleur={C.montee} taille={20} />
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>{x.titre}</Text>
              <Text style={S.petit}>{x.detail}</Text>
            </View>
            <Icone nom="fleche" couleur={C.gris} taille={18} />
          </Pressable>
        ))}
        {q.trim().length >= 2 && !trouvees.length && !miennes.length && !aVenir.length && (
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

/** Puce à cocher (jours de la semaine). */
function Puce({ texte, actif, onPress, label }: { texte: string; actif: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" aria-checked={actif} accessibilityLabel={label ?? texte}
               style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 22, alignItems: "center", justifyContent: "center",
                        backgroundColor: actif ? C.encre : C.fond, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: actif ? C.fond : C.encre }}>{texte}</Text>
    </Pressable>
  );
}

/**
 * Questionnaire du programme : niveau, séances, volume, plus longue sortie, objectif ; puis, facultatif,
 * records (allures personnelles), jours disponibles, jour de la sortie longue, relief, blessure.
 */
export function FormulaireQuestionnaire({ initial, course, onValider }: {
  initial: Questionnaire | null; course: CourseCible; onValider: (q: Questionnaire, date?: string) => void;
}) {
  const [q, setQ] = useState<Questionnaire>(initial ?? { niveau: "intermediaire", seances: 4, volume_km: 25, plus_longue_km: 12, objectif: "finir" });
  const [date, setDate] = useState(course.date ?? "");
  const maj = (p: Partial<Questionnaire>) => setQ({ ...q, ...p });
  const niveau = NIVEAUX.find((n) => n[0] === q.niveau)!;
  // records saisis en texte (« 45:30 ») ; seuls les temps lisibles vont dans le questionnaire
  const [textes, setTextes] = useState<Record<CleRecord, string>>(() => Object.fromEntries(RECORDS.map(([k]) => {
    const m = initial?.records?.[k];
    return [k, m ? tempsLisible(m) : ""];
  })) as Record<CleRecord, string>);
  const majRecord = (k: CleRecord, t: string) => {
    setTextes({ ...textes, [k]: t });
    const m = lireTemps(t);
    const records = { ...q.records };
    if (Number.isFinite(m) && m > 0) records[k] = m; else delete records[k];
    maj({ records: Object.keys(records).length ? records : undefined });
  };
  const al = useMemo(() => { const v = meilleurVdot(q.records); return v ? allures(v) : null; }, [q.records]);
  return (
    <View style={[S.carte, { gap: 14 }]}>
      <Text style={S.h2}>Pour un plan à ta mesure</Text>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Ton niveau</Text>
        <Segments options={NIVEAUX.map(([v, n]) => [v, n] as [Questionnaire["niveau"], string])} valeur={q.niveau} onChange={(niveau) => maj({ niveau })} />
        <Text style={S.petit}>{niveau[2]}.</Text>
      </View>
      <Ajusteur etiquette="Séances par semaine" valeur={q.seances} unite="" pas={1} min={2} max={6} onChange={(seances) => maj({ seances })} />
      <Ajusteur etiquette="Km par semaine aujourd'hui" valeur={q.volume_km} unite="km" pas={5} min={0} max={150} onChange={(volume_km) => maj({ volume_km })} />
      <Ajusteur etiquette="Plus longue sortie récente" valeur={q.plus_longue_km} unite="km" pas={1} min={0} max={80} onChange={(plus_longue_km) => maj({ plus_longue_km })} />
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Ton objectif</Text>
        <Segments options={[["finir", "Finir bien"], ["performance", "Un chrono"]]} valeur={q.objectif}
                  onChange={(objectif) => maj({ objectif })} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Date de la course</Text>
        <TextInput value={date} onChangeText={setDate} placeholder="AAAA-MM-JJ (sinon plan de 12 semaines)" autoCorrect={false}
                   accessibilityLabel="Date de la course" style={[champ, { backgroundColor: C.fond }]} />
        {date !== "" && !dateValide(date) && <Text style={{ fontSize: 12, color: C.monteeFonce }}>Format : 2027-02-14.</Text>}
      </View>
      <View style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.aire }}>
        <Text style={S.h2}>Pour aller plus loin (facultatif)</Text>
        <Text style={S.petit}>Chaque réponse rend le programme plus juste. Tu peux les ajouter plus tard.</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={S.fort}>Tes meilleurs temps de l'année</Text>
        <Text style={S.petit}>
          Un seul suffit (le plus récent). L'appli en tire tes allures d'entraînement (facile, seuil, fractionné) avec les
          tables VDOT de Jack Daniels. Format : 22:30 ou 1:45:00.
        </Text>
        {RECORDS.map(([k, nom]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{nom}</Text>
            <TextInput value={textes[k]} onChangeText={(t) => majRecord(k, t)} placeholder="—" autoCorrect={false}
                       accessibilityLabel={`Mon temps sur ${nom}`}
                       style={[champ, { width: 120, textAlign: "center", backgroundColor: C.fond, fontWeight: "700" }]} />
          </View>
        ))}
        {al && (
          <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
            Tes allures : facile {allureTexte(al.facile[0])}–{allureTexte(al.facile[1])} · marathon {allureTexte(al.marathon)} ·
            seuil {allureTexte(al.seuil)} · fractionné {allureTexte(al.vma)} (min/km).
          </Text>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={S.fort}>Tes jours pour courir</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {JOURS.map((nom, j) => (
            <Puce key={nom} texte={nom.slice(0, 3)} label={nom} actif={!!q.jours?.includes(j)}
                  onPress={() => {
                    const jours = q.jours?.includes(j) ? q.jours.filter((x) => x !== j) : [...(q.jours ?? []), j].sort();
                    maj({ jours: jours.length ? jours : undefined, seances: jours.length >= 2 ? Math.min(6, jours.length) : q.seances,
                          jourLongue: q.jourLongue !== undefined && jours.includes(q.jourLongue) ? q.jourLongue : undefined });
                  }} />
          ))}
        </View>
        <Text style={S.petit}>
          {q.jours?.length ? `${q.jours.length} jours : une séance par jour coché, les séances dures espacées. L'accueil te dit chaque jour quoi faire.`
            : "Sans jours cochés, l'appli propose les séances dans l'ordre, au fil de la semaine."}
        </Text>
        {q.jours && q.jours.length >= 2 && (
          <>
            <Text style={[S.fort, { fontWeight: "600" }]}>Jour de la sortie longue</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {q.jours.map((j) => (
                <Puce key={j} texte={JOURS[j].slice(0, 3)} label={`Sortie longue le ${JOURS[j].toLowerCase()}`}
                      actif={(q.jourLongue ?? (q.jours!.includes(6) ? 6 : q.jours!.includes(5) ? 5 : q.jours!.at(-1))) === j}
                      onPress={() => maj({ jourLongue: j })} />
              ))}
            </View>
          </>
        )}
      </View>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Le relief près de chez toi</Text>
        <Segments options={[["plat", "Plat"], ["cotes", "Des côtes"], ["montagne", "Montagne"]]} valeur={q.terrain ?? "cotes"}
                  onChange={(terrain) => maj({ terrain })} />
        <Text style={S.petit}>
          {(q.terrain ?? "cotes") === "plat" ? "Sans côte, les séances de côtes passent au tapis incliné, aux escaliers ou aux rampes."
            : (q.terrain ?? "cotes") === "montagne" ? "Montagne à moins d'une heure : les sorties longues peuvent s'y faire, avec le D+ de la course."
            : "Les séances de côtes t'ouvrent directement les meilleures côtes autour de toi."}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={S.fort}>Blessure ou longue coupure ces 6 derniers mois ?</Text>
        <Segments options={[["non", "Non"], ["oui", "Oui"]]} valeur={q.blessure ? "oui" : "non"} onChange={(v) => maj({ blessure: v === "oui" })} />
        <Text style={S.petit}>
          {q.blessure ? "Le programme repart 15 % plus bas et monte de 5 % par semaine au plus. Si une douleur revient, arrête et consulte."
            : "Le volume monte de 10 % par semaine au plus, avec une semaine allégée sur 4."}
        </Text>
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
                    <Text style={S.fort}>{x.jour !== undefined ? `${JOURS[x.jour]} · ` : ""}{x.titre}{x.seance ? ` : ${x.seance}` : ""}</Text>
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
