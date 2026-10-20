// Onglet « Nutrition » : glucides, eau et sel. Avec le parcours de ta course : un plan par
// ravitaillement ; sans parcours : pour une durée de sortie ou de course.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  besoinsParHeure, construirePlan, fourchetteGlucides, heuresLisibles, lireObjectif, NIVEAUX, pourquoiGlucides, recommandation,
  routineHoraire, type Niveau, type Preferences, type Ravito,
} from "../calcul/nutrition.ts";
import type { Parcours } from "../calcul/profil.ts";
import { Ajusteur, Icone, nombre, Section, Segments } from "../composants/communs.tsx";
import { partagerTexte } from "../fichiers.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 16,
                color: C.encre } as const;

function Reglage({ etiquette, valeur, unite, pas, min, max, conseil, horsPlage, onChange }: {
  etiquette: string; valeur: number; unite: string; pas: number; min?: number; max?: number; conseil: string;
  horsPlage?: string | null; onChange: (v: number) => void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Ajusteur etiquette={etiquette} valeur={valeur} unite={unite} pas={pas} min={min} max={max} onChange={onChange} />
      <Text style={S.petit}>{conseil}</Text>
      {horsPlage ? <Text style={{ fontSize: 12, color: C.monteeFonce, fontWeight: "600" }}>{horsPlage}</Text> : null}
    </View>
  );
}

function VueNutrition({ parcours, heures, ravitos, setRavitos, prefs: brutes, setPrefs, sansParcours }: {
  parcours: Parcours; heures: number; ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void;
  prefs: Preferences; setPrefs: (p: Preferences) => void; sansParcours: boolean;
}) {
  const [km, setKm] = useState("");
  const [nom, setNom] = useState("");
  const [produits, setProduits] = useState(false);
  // tant que rien n'est réglé à la main, les besoins suivent la durée et l'habitude
  const prefs = useMemo(() => (brutes.perso ? brutes : { ...brutes, ...recommandation(heures, brutes.niveau) }), [brutes, heures]);
  const regler = (partiel: Partial<Preferences>) => setPrefs({ ...prefs, ...partiel, perso: true });
  const plan = useMemo(() => construirePlan(parcours, heures, ravitos, prefs), [parcours, heures, ravitos, prefs]);
  const [gBas, gHaut] = fourchetteGlucides(heures);
  const besoins = besoinsParHeure(prefs);
  const total = plan.reduce((t, x) => ({ g: t.g + x.glucides_g, eau: t.eau + x.eau_ml, gels: t.gels + x.gels, barres: t.barres + x.barres }),
                            { g: 0, eau: 0, gels: 0, barres: 0 });
  function ajouter() {
    const k = parseFloat(km.replace(",", "."));
    if (!Number.isFinite(k) || k <= 0 || k >= parcours.distance_km) return;
    setRavitos([...ravitos, { km: k, nom: nom.trim() || `km ${nombre(k, 1)}` }].sort((a, b) => a.km - b.km));
    setKm("");
    setNom("");
  }
  const texte = () => [`Plan nutrition — ${parcours.nom} (objectif ${heuresLisibles(heures)})`,
    `Par heure : ${besoins.glucides} g de glucides, ${besoins.eau} ml d'eau, ${besoins.sodium} mg de sodium`,
    ...plan.map((t) => `${t.de} → ${t.a} (km ${nombre(t.km_debut, 1)}–${nombre(t.km_fin, 1)}, passage ${t.passage}) : ${t.resume.join(", ")}`)].join("\n");
  const kmInvalide = km.trim() !== "" && !(parseFloat(km.replace(",", ".")) > 0 && parseFloat(km.replace(",", ".")) < parcours.distance_km);

  return (
    <>
      <View style={[S.carte, { gap: 8 }]}>
        <Text style={S.h2}>Comment c'est calculé</Text>
        <Text style={[S.petit, { fontSize: 13, lineHeight: 19, color: C.encre }]}>
          {sansParcours ? `Pour ${heuresLisibles(heures)} d'effort. ` : `Ton objectif de ${heuresLisibles(heures)} fixe la durée d'effort. `}
          {pourquoiGlucides(heures)}{sansParcours ? " Tes besoins par heure, multipliés par la durée, donnent ce qu'il faut emporter."
            : " Le temps de chaque tronçon (selon sa pente) multiplié par tes besoins horaires donne ce qu'il faut emporter jusqu'au ravito suivant."}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[["Glucides", `${besoins.glucides} g/h`], ["Eau", `${besoins.eau} ml/h`], ["Sodium", `${besoins.sodium} mg/h`]].map(([t, v]) => (
            <View key={t} style={{ flex: 1, backgroundColor: C.fond, borderRadius: 12, padding: 10 }}>
              <Text style={S.petit}>{t}</Text>
              <Text style={[S.fort, { fontSize: 17 }]}>{v}</Text>
            </View>
          ))}
        </View>
        <Text style={S.petit}>{brutes.perso ? "Réglages personnalisés." : `Recommandé pour ${heuresLisibles(heures)}, profil « ${NIVEAUX.find((n) => n[0] === prefs.niveau)![1]} », ${prefs.temperature} °C.`}</Text>
      </View>

      <Section titre="Pendant la course, chaque heure">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          {routineHoraire(prefs).map((l) => (
            <View key={l} style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.montee, marginTop: 7 }} />
              <Text style={[S.petit, { flex: 1, fontSize: 14, color: C.encre }]}>{l}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section titre="Ce que tu emportes">
        <Text style={S.petit}>
          Au total : {nombre(total.g)} g de glucides ({total.gels} gel{total.gels > 1 ? "s" : ""}{total.barres ? `, ${total.barres} barre${total.barres > 1 ? "s" : ""}` : ""}) et {nombre(total.eau / 1000, 1)} L d'eau.
          {ravitos.length || sansParcours ? "" : " Ajoute tes ravitaillements plus bas pour découper le plan."}
        </Text>
        <View style={{ gap: 8 }}>
          {plan.map((t) => (
            <View key={t.n} style={{ backgroundColor: C.blanc, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <Text style={[S.fort, { flex: 1 }]}>{sansParcours ? `Pour ${heuresLisibles(t.duree_h)}` : `${t.de} → ${t.a}`}</Text>
                {!sansParcours && <Text style={S.petit}>km {nombre(t.km_debut, 1)} – {nombre(t.km_fin, 1)}</Text>}
              </View>
              {!sansParcours && (
                <Text style={[S.petit, { marginTop: 2 }]}>
                  {heuresLisibles(t.duree_h)} de course · arrivée estimée à {t.passage} · D+ {nombre(t.dplus_m)} m
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {t.resume.map((r) => (
                  <Text key={r} style={{ fontSize: 13, fontWeight: "600", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
                                         overflow: "hidden", backgroundColor: C.sable, color: C.encre }}>{r}</Text>
                ))}
              </View>
              <Text style={[S.petit, { marginTop: 6 }]}>= {nombre(t.glucides_g)} g de glucides, {nombre(t.eau_ml)} ml d'eau, {nombre(t.sodium_mg)} mg de sodium</Text>
            </View>
          ))}
          <Pressable onPress={() => partagerTexte("Plan nutrition", texte())} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Partager le plan</Text>
          </Pressable>
        </View>
      </Section>

      {!sansParcours && <Section titre="Ravitaillements">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          <Text style={S.petit}>Points où tu peux recharger (eau, nourriture) : le plan se découpe entre eux.</Text>
          {ravitos.map((r, i) => (
            <View key={`${r.km}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[S.fort, { flex: 1 }]}>km {nombre(r.km, 1)} · {r.nom}</Text>
              <Pressable onPress={() => setRavitos(ravitos.filter((_, k) => k !== i))} accessibilityRole="button"
                         accessibilityLabel={`Supprimer le ravitaillement ${r.nom}`}
                         style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22, color: C.gris }}>×</Text>
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={km} onChangeText={setKm} placeholder="km" keyboardType="decimal-pad"
                       style={[champ, { width: 64, backgroundColor: C.fond }]} accessibilityLabel="Kilomètre du ravitaillement" />
            <TextInput value={nom} onChangeText={setNom} placeholder="Nom (facultatif)" onSubmitEditing={ajouter}
                       style={[champ, { flex: 1, minWidth: 0, backgroundColor: C.fond }]} accessibilityLabel="Nom du ravitaillement" />
            <Pressable onPress={ajouter} disabled={!km.trim() || kmInvalide} accessibilityRole="button"
                       style={[S.bouton, { minHeight: 46, paddingHorizontal: 14, opacity: !km.trim() || kmInvalide ? 0.4 : 1 }]}>
              <Text style={S.boutonTexte}>Ajouter</Text>
            </Pressable>
          </View>
          {kmInvalide && <Text style={{ fontSize: 12, color: C.monteeFonce }}>Le km doit être entre 0 et {nombre(parcours.distance_km, 1)}.</Text>}
        </View>
      </Section>}

      <Section titre="Mes réglages" action={brutes.perso ? "Recommandations" : undefined}
               onAction={() => setPrefs({ ...brutes, perso: false })}>
        <View style={[S.carte, { marginTop: 0, gap: 14 }]}>
          <View style={{ gap: 6 }}>
            <Text style={S.fort}>Manger en courant, tu as l'habitude ?</Text>
            <Segments options={NIVEAUX.map(([v, n]) => [v, n] as [Niveau, string])} valeur={prefs.niveau}
                      onChange={(niveau) => setPrefs({ ...brutes, niveau, perso: false })} />
            <Text style={S.petit}>{NIVEAUX.find((n) => n[0] === prefs.niveau)![2]}. Choisir un profil remet les recommandations.</Text>
          </View>
          <Reglage etiquette="Température" valeur={prefs.temperature} unite="°C" pas={1} min={-10} max={45}
                   onChange={(temperature) => setPrefs({ ...brutes, temperature })}
                   conseil="Prévue le jour J. Au-dessus de 15 °C, l'eau et le sodium augmentent de 10 % par 5 °C." />
          <Reglage etiquette="Glucides" valeur={prefs.glucides} unite="g/h" pas={5} max={120} onChange={(glucides) => regler({ glucides })}
                   conseil={`Le carburant des muscles (gels, barres, boisson sucrée). Conseillé pour ta durée : ${gBas} à ${gHaut} g/h.`}
                   horsPlage={prefs.glucides > gHaut ? "Au-dessus de la fourchette : à tester d'abord à l'entraînement (risque digestif)."
                     : prefs.glucides < gBas ? "En dessous de la fourchette : risque de coup de barre en fin de course." : null} />
          <Reglage etiquette="Eau" valeur={prefs.eau} unite="ml/h" pas={50} max={1200} onChange={(eau) => regler({ eau })}
                   conseil="À 15 °C. Conseillé : 450 à 750 ml/h. Pour te mesurer : pèse-toi avant et après 1 h de course sans boire ; 1 kg perdu ≈ 1 L de sueur."
                   horsPlage={prefs.eau > 900 ? "Boire beaucoup plus que la sueur perdue peut diluer le sodium du sang (hyponatrémie)." : null} />
          <Reglage etiquette="Sodium" valeur={prefs.sodium} unite="mg/h" pas={50} max={1500} onChange={(sodium) => regler({ sodium })}
                   conseil={`Le sel perdu dans la sueur. Conseillé : 500 à 700 mg par litre bu, soit ${Math.round(prefs.eau * 0.5)} à ${Math.round(prefs.eau * 0.7)} mg/h avec ton eau. Plus si ta sueur laisse des traces blanches.`} />
          <Pressable onPress={() => setProduits(!produits)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>{produits ? "Masquer mes produits" : "Mes produits (taille des gels, barres, pastilles)"}</Text>
          </Pressable>
          {produits && <>
            <Reglage etiquette="Un gel" valeur={prefs.gelG} unite="g" pas={5} min={10} max={60} onChange={(gelG) => regler({ gelG })}
                     conseil="Glucides par gel, écrits sur l'emballage (souvent 20 à 30 g)." />
            <Reglage etiquette="Une barre" valeur={prefs.barreG} unite="g" pas={5} min={10} max={80} onChange={(barreG) => regler({ barreG })}
                     conseil="Glucides par barre (souvent 25 à 45 g)." />
            <Reglage etiquette="Part en solide" valeur={Math.round(prefs.partSolide * 100)} unite="%" pas={10} min={0} max={100}
                     onChange={(v) => regler({ partSolide: v / 100 })}
                     conseil="Part des glucides en barres ou salé : utile au-delà de 4 h pour éviter l'écœurement des gels." />
            <Reglage etiquette="Une pastille de sel" valeur={prefs.pastilleMg} unite="mg" pas={50} min={50} max={1000}
                     onChange={(pastilleMg) => regler({ pastilleMg })} conseil="Sodium par pastille ou capsule (souvent 200 à 300 mg)." />
          </>}
        </View>
      </Section>
      <Text style={[S.petit, { marginTop: 14 }]}>
        Sources : ACSM / Thomas et al. 2016 (glucides selon la durée) ; Jeukendrup 2014 (au-delà de 60 g/h, glucose + fructose) ;
        ISSN, Tiller et al. 2019 (eau et sodium en ultra). Ces repères ne remplacent pas un avis médical ; teste toujours ton plan à l'entraînement.
      </Text>
    </>
  );
}

/** Parcours plat fictif pour une durée seule (10 km/h) : le plan n'a alors qu'un tronçon. */
function parcoursDuree(heures: number): Parcours {
  const km = Math.max(1, heures * 10);
  return { nom: "Sortie", distance_km: km, dplus_m: 0, dmoins_m: 0, alt_min_m: 0, alt_max_m: 0, source_altitudes: "",
           profil: { d_km: [0, km], z_m: [0, 0] }, segments: [] } as unknown as Parcours;
}

export function EcranNutrition({ parcours, objectif, setObjectif, ravitos, setRavitos, prefs, setPrefs, onPreparer }: {
  parcours: Parcours | null; objectif: string; setObjectif: (v: string) => void; ravitos: Ravito[];
  setRavitos: (r: Ravito[]) => void; prefs: Preferences; setPrefs: (p: Preferences) => void; onPreparer: () => void;
}) {
  const [source, setSource] = useState<"course" | "duree">(parcours ? "course" : "duree");
  const [duree, setDuree] = useState(2);
  const avecCourse = source === "course" && parcours !== null;
  const heures = avecCourse ? lireObjectif(objectif) : duree;
  const objectifOk = Number.isFinite(heures) && heures > 0;
  const fictif = useMemo(() => parcoursDuree(duree), [duree]);
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ marginTop: 4 }}>
        <Segments options={[["course", parcours ? "Ma course" : "Ma course (GPX)"], ["duree", "Une durée"]]} valeur={source} onChange={setSource} />
      </View>
      {source === "course" && !parcours ? (
        <View style={[S.carte, { gap: 10, padding: 18 }]}>
          <Icone nom="course" couleur={C.montee} />
          <Text style={S.h2}>Un plan par ravitaillement</Text>
          <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
            Importe le GPX de ta course dans « Course » : le temps de chaque tronçon est calculé selon sa pente, puis ce qu'il faut
            emporter jusqu'au ravito suivant. Pour une simple sortie, choisis « Une durée ».
          </Text>
          <Pressable onPress={onPreparer} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Importer ma course</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {avecCourse ? (
            <View style={[S.carte, { gap: 6 }]}>
              <Text style={S.fort}>{parcours!.nom}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={[S.petit, { flex: 1 }]}>{nombre(parcours!.distance_km, 1)} km · D+ {nombre(parcours!.dplus_m)} m · objectif</Text>
                <TextInput value={objectif} onChangeText={setObjectif} placeholder="ex. 5h40" autoCapitalize="none"
                           accessibilityLabel="Objectif de temps"
                           style={[champ, { width: 110, textAlign: "center", backgroundColor: C.fond, fontWeight: "700" }]} />
              </View>
              {!objectifOk && <Text style={{ color: C.monteeFonce }}>Format attendu : 38h, 5h40 ou 90min.</Text>}
            </View>
          ) : (
            <View style={[S.carte, { gap: 6 }]}>
              <Ajusteur etiquette="Durée d'effort" valeur={duree} unite="h" pas={0.25} min={0.5} max={30} onChange={setDuree} />
              <Text style={S.petit}>{heuresLisibles(duree)} : sortie longue, trail court ou course sans GPX.</Text>
            </View>
          )}
          {objectifOk && (
            <VueNutrition parcours={avecCourse ? parcours! : fictif} heures={heures} ravitos={avecCourse ? ravitos : []}
                          setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} sansParcours={!avecCourse} />
          )}
        </>
      )}
    </ScrollView>
  );
}
