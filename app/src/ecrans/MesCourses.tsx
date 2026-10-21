// « Mes courses » : le calendrier de l'année (idée de Mathieu) — dates, inscriptions, prix du dossard
// et du logement, compte à rebours, et accès direct à la préparation.

import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  bilanAnnee, dateValide, joursAvant, NOMS_STATUT, parMois, prochaine, semainesPrepa, type CourseInscrite, type Statut,
} from "../calcul/calendrier.ts";
import { Icone, nombre, Section, Segments } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 15, color: C.encre } as const;
const VIDE: CourseInscrite = { id: "", nom: "", date: "", lieu: "", distance_km: 0, dplus_m: 0, dossard_eur: 0, logement_eur: 0,
                               lien: "", statut: "envisagee", objectif: "", temps: "" };
const COULEUR_STATUT: Record<Statut, [string, string]> = {
  envisagee: [C.sable, C.encre], inscrit: [C.monteeClair, C.monteeFonce], terminee: [C.platClair, C.platFonce],
};

const dateLongue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" });
const versNombre = (t: string) => { const v = parseFloat(t.replace(",", ".")); return Number.isFinite(v) && v >= 0 ? v : 0; };

function Champ({ etiquette, valeur, onChange, aide, clavier, largeur }: {
  etiquette: string; valeur: string; onChange: (v: string) => void; aide?: string; clavier?: "decimal-pad" | "url"; largeur?: number;
}) {
  return (
    <View style={{ gap: 4, flex: largeur ? undefined : 1, width: largeur, minWidth: 0 }}>
      <Text style={[S.petit, { color: C.encre, fontWeight: "600" }]}>{etiquette}</Text>
      <TextInput value={valeur} onChangeText={onChange} placeholder={aide} keyboardType={clavier} autoCapitalize="none"
                 accessibilityLabel={etiquette} style={champ} />
    </View>
  );
}

function Formulaire({ initiale, onValider, onSupprimer, onFermer }: {
  initiale: CourseInscrite; onValider: (c: CourseInscrite) => void; onSupprimer?: () => void; onFermer: () => void;
}) {
  const [c, setC] = useState({ ...initiale, distance: initiale.distance_km ? String(initiale.distance_km) : "",
                               dplus: initiale.dplus_m ? String(initiale.dplus_m) : "", dossard: initiale.dossard_eur ? String(initiale.dossard_eur) : "",
                               logement: initiale.logement_eur ? String(initiale.logement_eur) : "" });
  const maj = (p: Partial<typeof c>) => setC({ ...c, ...p });
  const ok = c.nom.trim() && dateValide(c.date);
  const valider = () => onValider({
    id: c.id || `${Date.now()}`, nom: c.nom.trim(), date: c.date, lieu: c.lieu.trim(), distance_km: versNombre(c.distance),
    dplus_m: versNombre(c.dplus), dossard_eur: versNombre(c.dossard), logement_eur: versNombre(c.logement), lien: c.lien.trim(),
    statut: c.statut, objectif: c.objectif.trim(), temps: c.temps.trim(),
  });
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.fond }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
        <Pressable onPress={onFermer} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: C.gris }}>Annuler</Text>
        </Pressable>
        <Text style={[S.h2, { flex: 1, textAlign: "center" }]}>{initiale.id ? "Modifier la course" : "Nouvelle course"}</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Champ etiquette="Nom de la course" valeur={c.nom} onChange={(nom) => maj({ nom })} aide="ex. Trail des Gayeulles" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Champ etiquette="Date" valeur={c.date} onChange={(date) => maj({ date })} aide="AAAA-MM-JJ" largeur={140} />
          <Champ etiquette="Lieu" valeur={c.lieu} onChange={(lieu) => maj({ lieu })} aide="ville" />
        </View>
        {c.date !== "" && !dateValide(c.date) && <Text style={{ color: C.monteeFonce, fontSize: 12 }}>Date au format 2026-11-15.</Text>}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Champ etiquette="Distance (km)" valeur={c.distance} onChange={(distance) => maj({ distance })} clavier="decimal-pad" />
          <Champ etiquette="D+ (m)" valeur={c.dplus} onChange={(dplus) => maj({ dplus })} clavier="decimal-pad" />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Champ etiquette="Dossard (€)" valeur={c.dossard} onChange={(dossard) => maj({ dossard })} clavier="decimal-pad" />
          <Champ etiquette="Logement, trajet (€)" valeur={c.logement} onChange={(logement) => maj({ logement })} clavier="decimal-pad" />
        </View>
        <Champ etiquette="Lien d'inscription" valeur={c.lien} onChange={(lien) => maj({ lien })} aide="https://…" clavier="url" />
        <View style={{ gap: 6 }}>
          <Text style={[S.petit, { color: C.encre, fontWeight: "600" }]}>Statut</Text>
          <Segments options={[["envisagee", "Envisagée"], ["inscrit", "Inscrit"], ["terminee", "Terminée"]]} valeur={c.statut}
                    onChange={(statut) => maj({ statut })} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Champ etiquette="Objectif" valeur={c.objectif} onChange={(objectif) => maj({ objectif })} aide="ex. 5h40" />
          {c.statut === "terminee" && <Champ etiquette="Temps réalisé" valeur={c.temps} onChange={(temps) => maj({ temps })} aide="ex. 5h32" />}
        </View>
        {onSupprimer && (
          <Pressable onPress={onSupprimer} accessibilityRole="button" style={[S.boutonClair, { marginTop: 8 }]}>
            <Text style={[S.boutonClairTexte, { color: C.monteeFonce }]}>Supprimer cette course</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: C.fond, borderTopWidth: 1, borderTopColor: C.sable }}>
        <Pressable onPress={valider} disabled={!ok} accessibilityRole="button" style={[S.bouton, { opacity: ok ? 1 : 0.45 }]}>
          <Text style={S.boutonTexte}>{ok ? "Enregistrer" : "Nom et date obligatoires"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function EcranMesCourses({ courses, setCourses, onPreparer }: {
  courses: CourseInscrite[]; setCourses: (c: CourseInscrite[]) => void; onPreparer: (c: CourseInscrite) => void;
}) {
  const [edition, setEdition] = useState<CourseInscrite | null>(null);
  const suivante = prochaine(courses);
  const annee = new Date().getFullYear();
  const bilan = bilanAnnee(courses, annee);
  const j = suivante ? joursAvant(suivante.date) : 0;
  const semaines = suivante ? semainesPrepa(suivante) : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
        {suivante ? (
          <View style={{ marginTop: 8, borderRadius: 22, backgroundColor: C.encre, padding: 18, gap: 6 }}>
            <Text style={{ color: "#F4F1EAB3", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
              Prochaine course · {NOMS_STATUT[suivante.statut].toLowerCase()}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <Text style={{ flex: 1, color: C.fond, fontSize: 24, fontWeight: "800" }} numberOfLines={2}>{suivante.nom}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: C.montee, fontSize: 34, fontWeight: "900" }}>{j === 0 ? "Jour J" : `J-${j}`}</Text>
              </View>
            </View>
            <Text style={{ color: "#F4F1EAD9", fontSize: 14 }}>
              {dateLongue(suivante.date)}{suivante.lieu ? ` · ${suivante.lieu}` : ""}
              {suivante.distance_km ? ` · ${nombre(suivante.distance_km, 1)} km` : ""}{suivante.dplus_m ? ` · ${nombre(suivante.dplus_m)} m D+` : ""}
            </Text>
            <Text style={{ color: "#F4F1EAB3", fontSize: 12 }}>
              Repère : {semaines} semaines de préparation pour cet effort{j / 7 < semaines ? " — c'est le moment de s'y mettre." : "."}
            </Text>
            <Pressable onPress={() => onPreparer(suivante)} accessibilityRole="button"
                       style={[S.bouton, { backgroundColor: C.montee, marginTop: 8 }]}>
              <Text style={[S.boutonTexte, { color: C.blanc }]}>Préparer cette course</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[S.carte, { gap: 8, padding: 18 }]}>
            <Icone nom="calendrier" couleur={C.montee} />
            <Text style={S.h2}>Ton calendrier de l'année</Text>
            <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
              Note les courses qui te tentent et celles où tu es inscrit : dates, prix du dossard et du logement, lien
              d'inscription. L'appli calcule le compte à rebours, ton budget et te dit quand commencer la préparation.
            </Text>
          </View>
        )}

        <Pressable onPress={() => setEdition(VIDE)} accessibilityRole="button" style={[S.bouton, { marginTop: 12, flexDirection: "row", gap: 8 }]}>
          <Icone nom="plus" couleur={C.fond} /><Text style={S.boutonTexte}>Ajouter une course</Text>
        </Pressable>

        {bilan.nombre > 0 && (
          <Section titre={`Mon année ${annee}`}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[["Courses", nombre(bilan.nombre)], ["Km", nombre(bilan.km)], ["D+", `${nombre(bilan.dplus)} m`], ["Budget", `${nombre(bilan.budget)} €`]]
                .map(([t, v]) => (
                  <View key={t} style={{ flex: 1, backgroundColor: C.blanc, borderRadius: 14, padding: 10 }}>
                    <Text style={S.petit}>{t}</Text>
                    <Text style={[S.fort, { fontSize: 16 }]} numberOfLines={1}>{v}</Text>
                  </View>
                ))}
            </View>
            <Text style={S.petit}>Courses où tu es inscrit ou déjà terminées ; budget = dossards + logement et trajet.</Text>
          </Section>
        )}

        {parMois(courses).map(([mois, liste]) => (
          <Section key={mois} titre={mois[0].toUpperCase() + mois.slice(1)}>
            <View style={{ gap: 8 }}>
              {liste.map((c) => {
                const [fond, texte] = COULEUR_STATUT[c.statut];
                return (
                  <Pressable key={c.id} onPress={() => setEdition(c)} accessibilityRole="button" style={[S.ligne, { alignItems: "flex-start" }]}>
                    <View style={{ width: 46, alignItems: "center" }}>
                      <Text style={{ fontSize: 20, fontWeight: "800", color: C.encre }}>{Number(c.date.slice(8, 10))}</Text>
                      <Text style={S.petit}>{new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short" })}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={S.fort} numberOfLines={1}>{c.nom}</Text>
                      <Text style={S.petit} numberOfLines={1}>
                        {[c.lieu, c.distance_km ? `${nombre(c.distance_km, 1)} km` : "", c.dplus_m ? `${nombre(c.dplus_m)} m D+` : "",
                          c.dossard_eur + c.logement_eur ? `${nombre(c.dossard_eur + c.logement_eur)} €` : ""].filter(Boolean).join(" · ")}
                      </Text>
                      {c.statut === "terminee" && c.temps ? <Text style={[S.petit, { color: C.encre }]}>Temps : {c.temps}{c.objectif ? ` (objectif ${c.objectif})` : ""}</Text> : null}
                      {c.lien ? (
                        <Pressable onPress={() => Linking.openURL(c.lien)} accessibilityRole="link" hitSlop={6}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee }}>Page d'inscription</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "700", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
                                   overflow: "hidden", backgroundColor: fond, color: texte }}>{NOMS_STATUT[c.statut]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        ))}

        <Text style={[S.petit, { marginTop: 18 }]}>
          Pour trouver une course près de chez toi : menu → Courses à venir (courses publiées par les offices de tourisme et les
          agendas publics). Les dates d'ouverture des inscriptions sont sur le site officiel de chaque course.
        </Text>
      </ScrollView>
      {edition && (
        <Formulaire initiale={edition} onFermer={() => setEdition(null)}
                    onSupprimer={edition.id ? () => { setCourses(courses.filter((x) => x.id !== edition.id)); setEdition(null); } : undefined}
                    onValider={(n) => { setCourses([...courses.filter((x) => x.id !== n.id), n]); setEdition(null); }} />
      )}
    </View>
  );
}
