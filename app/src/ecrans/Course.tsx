// Onglet « Course » : un parcours (GPX importé ou exemple), puis trois vues :
// Parcours (profil et segments), Passages (temps estimés), Nutrition (ravitos et quantités).

import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  construirePlan, heuresLisibles, lireObjectif, tempsDePassage, type Preferences, type Ravito,
} from "../calcul/nutrition.ts";
import { analyserGpx } from "../calcul/parcours.ts";
import type { Parcours } from "../calcul/profil.ts";
import { Ajusteur, Icone, nombre, Section, Segments, Tuiles } from "../composants/communs.tsx";
import { ProfilParcours } from "../composants/graphiques.tsx";
import { choisirGpx, partagerTexte } from "../fichiers.ts";
import { C, COULEUR_TYPE, S } from "../theme.ts";

type Vue = "parcours" | "passages" | "nutrition";

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

function VueNutrition({ parcours, heures, ravitos, setRavitos, prefs, setPrefs }: {
  parcours: Parcours; heures: number; ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void;
  prefs: Preferences; setPrefs: (p: Preferences) => void;
}) {
  const [km, setKm] = useState("");
  const [nom, setNom] = useState("");
  const plan = useMemo(() => construirePlan(parcours, heures, ravitos, prefs), [parcours, heures, ravitos, prefs]);
  function ajouter() {
    const k = parseFloat(km.replace(",", "."));
    if (!Number.isFinite(k) || k <= 0 || k >= parcours.distance_km) return;
    setRavitos([...ravitos, { km: k, nom: nom.trim() || `km ${nombre(k, 1)}` }].sort((a, b) => a.km - b.km));
    setKm("");
    setNom("");
  }
  const texte = () => [`Plan nutrition — ${parcours.nom} (objectif ${heuresLisibles(heures)})`,
    ...plan.map((t) => `${t.de} → ${t.a} (km ${nombre(t.km_debut, 1)}–${nombre(t.km_fin, 1)}, passage ${t.passage}) : ${t.resume.join(", ")}`)].join("\n");
  return (
    <>
      <Section titre="Ce que tu emportes">
        <View style={{ gap: 8 }}>
          {plan.map((t) => (
            <View key={t.n} style={{ backgroundColor: C.blanc, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <Text style={[S.fort, { flex: 1 }]}>{t.de} → {t.a}</Text>
                <Text style={S.petit}>km {nombre(t.km_debut, 1)} – {nombre(t.km_fin, 1)}</Text>
              </View>
              <Text style={[S.petit, { marginTop: 2 }]}>Arrivée estimée à {t.passage} · D+ {nombre(t.dplus_m)} m</Text>
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {t.resume.map((r) => (
                  <Text key={r} style={{ fontSize: 13, fontWeight: "600", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
                                         overflow: "hidden", backgroundColor: C.sable, color: C.encre }}>{r}</Text>
                ))}
              </View>
            </View>
          ))}
          <Pressable onPress={() => partagerTexte("Plan nutrition", texte())} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Partager le plan</Text>
          </Pressable>
        </View>
      </Section>

      <Section titre="Ravitaillements">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          {ravitos.length === 0 && <Text style={S.petit}>Aucun pour l'instant : tout le parcours est un seul tronçon.</Text>}
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
            <TextInput value={nom} onChangeText={setNom} placeholder="Nom" onSubmitEditing={ajouter}
                       style={[champ, { flex: 1, minWidth: 0, backgroundColor: C.fond }]} accessibilityLabel="Nom du ravitaillement" />
            <Pressable onPress={ajouter} accessibilityRole="button" style={[S.bouton, { minHeight: 46, paddingHorizontal: 14 }]}>
              <Text style={S.boutonTexte}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      </Section>

      <Section titre="Mes besoins par heure">
        <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
          <Ajusteur etiquette="Glucides" valeur={prefs.glucides} unite="g" pas={5} max={150} onChange={(v) => setPrefs({ ...prefs, glucides: v })} />
          <Ajusteur etiquette="Eau" valeur={prefs.eau} unite="ml" pas={50} max={1500} onChange={(v) => setPrefs({ ...prefs, eau: v })} />
          <Ajusteur etiquette="Sodium" valeur={prefs.sodium} unite="mg" pas={50} max={2000} onChange={(v) => setPrefs({ ...prefs, sodium: v })} />
          <Ajusteur etiquette="Température" valeur={prefs.temperature} unite="°C" pas={1} min={-10} max={45}
                    onChange={(v) => setPrefs({ ...prefs, temperature: v })} />
          <Text style={S.petit}>Eau et sodium +10 % par tranche de 5 °C au-dessus de 15 °C.</Text>
        </View>
      </Section>
    </>
  );
}

export function EcranCourse({ parcours, onParcours, onExemple, objectif, setObjectif, ravitos, setRavitos, prefs, setPrefs }: {
  parcours: Parcours | null; onParcours: (p: Parcours) => void; onExemple: () => void;
  objectif: string; setObjectif: (v: string) => void; ravitos: Ravito[]; setRavitos: (r: Ravito[]) => void;
  prefs: Preferences; setPrefs: (p: Preferences) => void;
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
        <Segments options={[["parcours", "Parcours"], ["passages", "Passages"], ["nutrition", "Nutrition"]]} valeur={vue} onChange={setVue} />
      </View>
      {vue === "parcours" && <VueParcours parcours={parcours} />}
      {vue === "passages" && objectifOk && <VuePassages parcours={parcours} heures={heures} />}
      {vue === "nutrition" && objectifOk && (
        <VueNutrition parcours={parcours} heures={heures} ravitos={ravitos} setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} />
      )}
    </ScrollView>
  );
}
