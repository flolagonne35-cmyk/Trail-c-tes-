// Courses → Ma course → « Jour J » : la feuille de course en une page. Objectif et heure de départ,
// section par section (temps, heure de passage, conseil), ravitaillements avec ce qu'il faut prendre,
// barrières horaires et marge, matériel à cocher ; à partager ou à envoyer à la montre (GPX).

import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { interp } from "../calcul/geo.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { feuilleJourJ, horloge, lireHeure, marges, materiel, type Barriere } from "../calcul/jourj.ts";
import { construirePlan, heuresLisibles, lireObjectif, recommandation, type Preferences, type Ravito } from "../calcul/nutrition.ts";
import type { Parcours } from "../calcul/profil.ts";
import { soleil } from "../calcul/soleil.ts";
import { nombre, Section } from "../composants/communs.tsx";
import { partagerFichier, partagerTexte } from "../fichiers.ts";
import { C, COULEUR_TYPE, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 17, color: C.encre,
                fontWeight: "700", textAlign: "center" } as const;

/** « 12 », « 12,5 » : pas de « ,0 » inutile. */
const kmT = (k: number) => nombre(k, Math.round(k * 10) % 10 ? 1 : 0);

export type ReglagesJourJ = { depart: string; barrieres: Barriere[]; coches: string[] };
export const JOURJ_DEFAUT: ReglagesJourJ = { depart: "8:00", barrieres: [], coches: [] };

export function VueJourJ({ parcours, objectif, setObjectif, ravitos, prefs, dateCourse, reglages, setReglages, onNutrition }: {
  parcours: Parcours; objectif: string; setObjectif: (v: string) => void; ravitos: Ravito[]; prefs: Preferences;
  dateCourse?: string; reglages: ReglagesJourJ; setReglages: (r: ReglagesJourJ) => void; onNutrition: () => void;
}) {
  const heures = lireObjectif(objectif);
  const objectifOk = Number.isFinite(heures) && heures > 0;
  const departMin = lireHeure(reglages.depart);
  const departOk = Number.isFinite(departMin);
  const lignes = useMemo(() => (objectifOk ? feuilleJourJ(parcours, heures, departOk ? departMin : undefined) : []),
                         [parcours, heures, objectifOk, departMin, departOk]);
  // nutrition par ravitaillement : mêmes besoins que l'onglet Nutrition
  const troncons = useMemo(() => {
    if (!objectifOk) return [];
    const besoins = prefs.perso ? prefs : { ...prefs, ...recommandation(heures, prefs.niveau) };
    return construirePlan(parcours, heures, ravitos, besoins);
  }, [parcours, heures, ravitos, prefs, objectifOk]);
  const [kmB, setKmB] = useState("");
  const [heureB, setHeureB] = useState("");
  const listeMarges = objectifOk && departOk ? marges(parcours, heures, departMin, reglages.barrieres) : [];

  // nuit : départ avant le lever ou arrivée après le coucher (au départ de la course, le jour de la course)
  const t = parcours.trace;
  const jour = dateCourse ? new Date(`${dateCourse}T12:00:00`) : new Date();
  const sol = t ? soleil(jour, { lat: t.lat[0], lon: t.lon[0] }) : null;
  const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const nuit = !!(sol && departOk && objectifOk
    && (departMin < minutes(sol.lever) || departMin + heures * 60 > minutes(sol.coucher) || heures > 12));
  const liste = objectifOk ? materiel(parcours, heures, nuit) : [];

  const texte = () => [
    `Feuille de course — ${parcours.nom}`,
    `${nombre(parcours.distance_km, 1)} km, ${nombre(parcours.dplus_m)} m D+ · objectif ${heuresLisibles(heures)}${departOk ? ` · départ ${horloge(departMin, 0)}, arrivée ≈ ${horloge(departMin, heures)}` : ""}`,
    "",
    ...lignes.map((l) => `km ${kmT(l.segment.km_debut)}→${kmT(l.segment.km_fin)} ${l.segment.type} ${l.segment.type === "descente" ? `−${l.segment.dmoins_m}` : `+${l.segment.dplus_m}`} m : ${heuresLisibles(l.duree_h)}${l.heure ? `, passage ${l.heure}` : ""}. ${l.conseil}`),
    "",
    ...troncons.map((x) => `${x.de} → ${x.a} : ${x.resume.join(", ")}`),
    ...listeMarges.map((m) => `Barrière ${m.nom} (km ${kmT(m.km)}) : marge ${m.marge} min`),
  ].join("\n");

  const exporterGpx = () => {
    if (!t) return;
    const points = t.lat.map((lat, i) => ({ lat, lon: t.lon[i] }));
    const reperes = troncons.slice(0, -1).map((x) => {
      const i = Math.max(0, t.d_km.findIndex((d) => d >= x.km_fin));
      return { lat: t.lat[i], lon: t.lon[i], nom: `${x.a} (km ${kmT(x.km_fin)})`,
               detail: `Passage ≈ ${departOk ? horloge(departMin, x.passage_h) : x.passage}. Pour la suite : ${troncons[x.n]?.resume.join(", ") ?? ""}` };
    });
    return partagerFichier("course-jour-j.gpx", ecrireGpx(parcours.nom, points, reperes));
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={[S.carte, { gap: 12 }]}>
        <Text style={S.h2}>Mon plan de course</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>Objectif de temps</Text>
          <TextInput value={objectif} onChangeText={setObjectif} placeholder="5h40" autoCapitalize="none" accessibilityLabel="Objectif de temps"
                     style={[champ, { width: 110 }]} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>Heure de départ</Text>
          <TextInput value={reglages.depart} onChangeText={(depart) => setReglages({ ...reglages, depart })} placeholder="8:00"
                     accessibilityLabel="Heure de départ" style={[champ, { width: 110 }]} />
        </View>
        {!objectifOk && <Text style={{ color: C.monteeFonce }}>Écris l'objectif comme 5h40, 38h ou 90min.</Text>}
        {objectifOk && (
          <Text style={[S.fort, { fontSize: 17, color: C.descenteFonce }]}>
            {departOk ? `Arrivée prévue vers ${horloge(departMin, heures)}` : `Durée ${heuresLisibles(heures)}`} · moyenne{" "}
            {nombre(parcours.distance_km / heures, 1)} km/h
          </Text>
        )}
        <Text style={S.petit}>Temps de chaque section selon sa pente (coût de la course en côte, Minetti 2002), recalé sur ton objectif.</Text>
      </View>

      {objectifOk && (
        <>
          <Section titre="Section par section">
            <View style={{ gap: 10 }}>
              {lignes.map((l) => {
                const s = l.segment;
                const couleur = COULEUR_TYPE[s.type];
                return (
                  <View key={s.n} style={{ backgroundColor: C.blanc, borderRadius: 16, padding: 14, gap: 8, borderLeftWidth: 6, borderLeftColor: couleur.trait }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                      <Text style={[S.fort, { flex: 1 }]}>km {kmT(s.km_debut)} → {kmT(s.km_fin)}</Text>
                      <Text style={[S.fort, { color: C.descenteFonce }]}>{l.heure ?? `+${heuresLisibles(l.arrivee_h)}`}</Text>
                    </View>
                    <Text style={[S.petit, { color: C.encre, fontSize: 14 }]}>
                      {s.type[0].toUpperCase() + s.type.slice(1)} · {s.type === "descente" ? `−${nombre(s.dmoins_m)}` : `+${nombre(s.dplus_m)}`} m
                      {s.type !== "plat" ? ` à ${nombre(Math.abs(s.pente_moy_pct), 1)} %` : ""} · {heuresLisibles(l.duree_h)} ({l.allure} /km)
                    </Text>
                    <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>{l.conseil}</Text>
                  </View>
                );
              })}
            </View>
          </Section>

          <Section titre="Ravitaillements">
            <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
              {!ravitos.length && (
                <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
                  Ajoute les ravitos de la course (km et nom, sur le site de l'organisateur) dans l'onglet Nutrition : chaque ravito
                  apparaîtra ici avec ton heure de passage et ce qu'il faut prendre jusqu'au suivant.
                </Text>
              )}
              {troncons.map((x) => (
                <View key={x.n} style={{ gap: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.aire }}>
                  <Text style={S.fort}>{x.de} → {x.a} <Text style={S.petit}>(km {kmT(x.km_fin)}, {departOk ? horloge(departMin, x.passage_h) : x.passage})</Text></Text>
                  <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>À emporter : {x.resume.join(", ")}</Text>
                </View>
              ))}
              <Pressable onPress={onNutrition} accessibilityRole="button" style={S.boutonClair}>
                <Text style={S.boutonClairTexte}>{ravitos.length ? "Modifier ravitos et nutrition" : "Ajouter mes ravitos"}</Text>
              </Pressable>
            </View>
          </Section>

          <Section titre="Barrières horaires">
            <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
              <Text style={S.petit}>Heures limites du règlement : l'appli calcule ta marge à ton allure prévue.</Text>
              {listeMarges.map((m, i) => (
                <View key={`${m.km}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[S.fort, { flex: 1 }]}>km {kmT(m.km)} · limite {horloge(m.heureMin, 0)}</Text>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: m.marge < 30 ? C.monteeFonce : C.descenteFonce }}>
                    {m.marge >= 0 ? `${m.marge} min d'avance` : `${-m.marge} min de retard ⚠`}
                  </Text>
                  <Pressable onPress={() => setReglages({ ...reglages, barrieres: reglages.barrieres.filter((_, k) => k !== i) })}
                             accessibilityRole="button" accessibilityLabel={`Supprimer la barrière du km ${m.km}`}
                             style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 22, color: C.gris }}>×</Text>
                  </Pressable>
                </View>
              ))}
              {!departOk && <Text style={{ color: C.monteeFonce }}>Indique l'heure de départ pour calculer les marges.</Text>}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={kmB} onChangeText={setKmB} placeholder="km" keyboardType="decimal-pad" accessibilityLabel="Kilomètre de la barrière"
                           style={[champ, { width: 80 }]} />
                <TextInput value={heureB} onChangeText={setHeureB} placeholder="14:30" accessibilityLabel="Heure limite"
                           style={[champ, { flex: 1 }]} />
                <Pressable accessibilityRole="button"
                           onPress={() => {
                             const km = parseFloat(kmB.replace(",", "."));
                             const h = lireHeure(heureB);
                             if (!(km > 0 && km <= parcours.distance_km) || !Number.isFinite(h)) return;
                             setReglages({ ...reglages, barrieres: [...reglages.barrieres, { km, heureMin: h, nom: `km ${nombre(km, 1)}` }].sort((a, b) => a.km - b.km) });
                             setKmB(""); setHeureB("");
                           }}
                           style={[S.bouton, { paddingHorizontal: 14 }]}>
                  <Text style={S.boutonTexte}>Ajouter</Text>
                </Pressable>
              </View>
            </View>
          </Section>

          <Section titre="Mon sac">
            <View style={[S.carte, { marginTop: 0, gap: 4 }]}>
              {liste.map((x) => {
                const coche = reglages.coches.includes(x);
                return (
                  <Pressable key={x} accessibilityRole="checkbox" aria-checked={coche}
                             onPress={() => setReglages({ ...reglages, coches: coche ? reglages.coches.filter((c) => c !== x) : [...reglages.coches, x] })}
                             style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: coche ? C.encre : C.sable,
                                   backgroundColor: coche ? C.encre : C.blanc, alignItems: "center", justifyContent: "center" }}>
                      {coche && <Text style={{ color: C.fond, fontWeight: "800" }}>✓</Text>}
                    </View>
                    <Text style={[S.petit, { flex: 1, fontSize: 15, color: C.encre, textDecorationLine: coche ? "line-through" : "none" }]}>{x}</Text>
                  </Pressable>
                );
              })}
              <Text style={[S.petit, { marginTop: 6 }]}>
                {nuit ? "Tu cours de nuit sur une partie de la course (lever et coucher du soleil calculés au départ). " : ""}
                Le matériel obligatoire du règlement fait foi : il est contrôlé au retrait du dossard.
              </Text>
            </View>
          </Section>

          <View style={{ gap: 10, marginTop: 18 }}>
            {t && (
              <Pressable onPress={exporterGpx} accessibilityRole="button" style={S.bouton}>
                <Text style={S.boutonTexte}>Envoyer à ma montre (GPX avec les ravitos)</Text>
              </Pressable>
            )}
            <Pressable onPress={() => partagerTexte("Feuille de course", texte())} accessibilityRole="button" style={S.boutonClair}>
              <Text style={S.boutonClairTexte}>Partager ou imprimer ma feuille</Text>
            </Pressable>
            {!t && <Text style={S.petit}>Importe le GPX de la course pour l'envoyer à ta montre avec les ravitos.</Text>}
          </View>
          {/* utilisé pour l'heure au point le plus haut : repère pour la météo du sommet */}
          {t && departOk && (
            <Text style={[S.petit, { marginTop: 10 }]}>
              Point le plus haut ({nombre(parcours.alt_max_m)} m) vers{" "}
              {horloge(departMin, interp(parcours.profil.d_km[parcours.profil.z_m.indexOf(Math.max(...parcours.profil.z_m))] * 1000,
                lignes.length ? [0, ...lignes.map((l) => l.segment.km_fin * 1000)] : [0], [0, ...lignes.map((l) => l.arrivee_h)]))}
              {" "}: regarde la météo du sommet pour cette heure-là.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
