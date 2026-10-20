// Onglet « Course » : un parcours (GPX importé ou exemple), puis trois vues :
// Parcours (profil et segments), Passages (temps estimés), Nutrition (ravitos et quantités).

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  besoinsParHeure, construirePlan, fourchetteGlucides, heuresLisibles, lireObjectif, NIVEAUX, pourquoiGlucides, recommandation,
  routineHoraire, tempsDePassage, type Niveau, type Preferences, type Ravito,
} from "../calcul/nutrition.ts";
import { kmLisibles, type Cote, type CoteProche } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { analyserGpx } from "../calcul/parcours.ts";
import { passagesCles } from "../calcul/seances.ts";
import type { Parcours } from "../calcul/profil.ts";
import { Ajusteur, Icone, nombre, Section, Segments, Tuiles } from "../composants/communs.tsx";
import { ProfilParcours } from "../composants/graphiques.tsx";
import { choisirGpx, partagerTexte } from "../fichiers.ts";
import { C, COULEUR_TYPE, S } from "../theme.ts";

type Vue = "parcours" | "passages" | "nutrition" | "prepa";

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

function Vide({ onImporter, onExemple, etat, erreur }: {
  onImporter: () => void; onExemple: () => void; etat: string | null; erreur: string | null;
}) {
  const etapes: [Parameters<typeof Icone>[0]["nom"], string, string][] = [
    ["course", "Le parcours découpé", "Montées, descentes et plats, avec distance, D+, pente et difficulté."],
    ["chrono", "Tes temps de passage", "À chaque kilomètre, selon la pente et ton objectif de temps."],
    ["nutrition", "Ton plan nutrition", "Eau, glucides et sel entre chaque ravitaillement."],
  ];
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Text style={[S.surtitre, { marginTop: 12 }]}>Course</Text>
      <Text style={S.titre} accessibilityRole="header">Prépare ta prochaine course</Text>
      <Text style={S.sousTitre}>Importe le fichier GPX du parcours : celui de ta montre, de Strava ou du site de l'organisateur.</Text>
      <View style={{ gap: 10, marginTop: 20 }}>
        {etapes.map(([icone, titre, texte]) => (
          <View key={titre} style={[S.ligne, { alignItems: "flex-start" }]}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.monteeClair, alignItems: "center",
                           justifyContent: "center" }}><Icone nom={icone} couleur={C.monteeFonce} /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>{titre}</Text>
              <Text style={S.petit}>{texte}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={onImporter} disabled={!!etat} accessibilityRole="button" style={[S.bouton, { marginTop: 22 }]}>
        <Text style={S.boutonTexte}>Importer un GPX</Text>
      </Pressable>
      <Pressable onPress={onExemple} accessibilityRole="button" style={[S.boutonClair, { marginTop: 10 }]}>
        <Text style={S.boutonClairTexte}>Voir avec un exemple : l'Alpe d'Huez</Text>
      </Pressable>
      <EtatImport etat={etat} erreur={erreur} />
    </ScrollView>
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
        Les plus grosses montées et descentes de la course, et pour chacune la côte proche de {nomDepart} la plus semblable
        en pente. Les répétitions redonnent le dénivelé du passage.
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
                {e.repetitions} × {nombre(Math.round(e.cote.longueur_m / 10) * 10)} m à {descente ? "−" : ""}{nombre(e.cote.pente_moy_pct, 1)} %
              </Text>
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

function VueNutrition({ parcours, heures, ravitos, setRavitos, prefs: brutes, setPrefs }: {
  parcours: Parcours; heures: number; ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void;
  prefs: Preferences; setPrefs: (p: Preferences) => void;
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
          Ton objectif de {heuresLisibles(heures)} fixe la durée d'effort. {pourquoiGlucides(heures)} Le temps de chaque
          tronçon (selon sa pente) multiplié par tes besoins horaires donne ce qu'il faut emporter jusqu'au ravito suivant.
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
          {ravitos.length ? "" : " Ajoute tes ravitaillements plus bas pour découper le plan."}
        </Text>
        <View style={{ gap: 8 }}>
          {plan.map((t) => (
            <View key={t.n} style={{ backgroundColor: C.blanc, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <Text style={[S.fort, { flex: 1 }]}>{t.de} → {t.a}</Text>
                <Text style={S.petit}>km {nombre(t.km_debut, 1)} – {nombre(t.km_fin, 1)}</Text>
              </View>
              <Text style={[S.petit, { marginTop: 2 }]}>
                {heuresLisibles(t.duree_h)} de course · arrivée estimée à {t.passage} · D+ {nombre(t.dplus_m)} m
              </Text>
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

      <Section titre="Ravitaillements">
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
      </Section>

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

export function EcranCourse({ parcours, onParcours, onExemple, objectif, setObjectif, ravitos, setRavitos, prefs, setPrefs,
                              cotes, position, nomDepart, onChoisir }: {
  parcours: Parcours | null; onParcours: (p: Parcours) => void; onExemple: () => void;
  objectif: string; setObjectif: (v: string) => void; ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void;
  prefs: Preferences; setPrefs: (p: Preferences) => void;
  cotes: Cote[]; position: Position; nomDepart: string; onChoisir: (c: CoteProche, rang: number) => void;
}) {
  const [vue, setVue] = useState<Vue>("parcours");
  const { etat, erreur, importer } = useImport(onParcours);
  if (!parcours) return <Vide onImporter={importer} onExemple={onExemple} etat={etat} erreur={erreur} />;

  const heures = lireObjectif(objectif);
  const objectifOk = Number.isFinite(heures) && heures > 0;
  const source = parcours.source_altitudes.startsWith("IGN") ? "altitudes IGN" : parcours.source_altitudes;
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
        <Text style={[S.surtitre, { flex: 1 }]}>Ma course</Text>
        <Pressable onPress={importer} disabled={!!etat} accessibilityRole="button" hitSlop={10}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Changer de parcours</Text>
        </Pressable>
      </View>
      <Text style={S.titre} accessibilityRole="header">{parcours.nom}</Text>
      <Text style={S.sousTitre}>{nombre(parcours.distance_km, 1)} km · {source}</Text>
      <EtatImport etat={etat} erreur={erreur} />
      <Tuiles valeurs={[["D+", `${nombre(parcours.dplus_m)} m`], ["D−", `${nombre(parcours.dmoins_m)} m`],
                        ["Alt. max", `${nombre(parcours.alt_max_m)} m`]]} />

      <View style={[S.carte, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <Icone nom="chrono" couleur={C.montee} />
        <Text style={[S.fort, { flex: 1 }]}>Objectif de temps</Text>
        <TextInput value={objectif} onChangeText={setObjectif} placeholder="ex. 5h40" autoCapitalize="none"
                   accessibilityLabel="Objectif de temps"
                   style={[champ, { width: 110, textAlign: "center", backgroundColor: C.fond, fontWeight: "700" }]} />
      </View>
      {!objectifOk && <Text style={{ color: C.monteeFonce, marginTop: 6 }}>Format attendu : 38h, 5h40 ou 90min.</Text>}

      <View style={{ marginTop: 16 }}>
        <Segments options={[["parcours", "Profil"], ["passages", "Passages"], ["nutrition", "Nutrition"], ["prepa", "Prépa"]]}
                  valeur={vue} onChange={setVue} />
      </View>
      {vue === "parcours" && <VueParcours parcours={parcours} />}
      {vue === "prepa" && <VuePrepa parcours={parcours} cotes={cotes} position={position} nomDepart={nomDepart} onChoisir={onChoisir} />}
      {vue === "passages" && objectifOk && <VuePassages parcours={parcours} heures={heures} />}
      {vue === "nutrition" && objectifOk && (
        <VueNutrition parcours={parcours} heures={heures} ravitos={ravitos} setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} />
      )}
    </ScrollView>
  );
}
