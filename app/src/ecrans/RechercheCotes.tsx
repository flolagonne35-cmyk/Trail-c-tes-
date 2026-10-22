// « Que cherches-tu ? » (onglet Côtes) : critères en plages min–max (pente, passage le plus raide,
// longueur, D+, distance), sol, type de voie, trafic ; puis l'ordre des résultats et leur nombre.

import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { cotesProches, TRIS, type CleTri, type Cote, type Filtres, type Sol, type TypeVoie } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { nombre, Segments } from "../composants/communs.tsx";
import { indiceDe, Plage } from "../composants/Plage.tsx";
import { C, S } from "../theme.ts";

export const FILTRES_DEFAUT: Filtres = {
  rayonM: 5000, penteMin: 4, types: ["route", "piste cyclable", "chemin", "sentier"], dplusMin: 0, eviterPassant: false,
  sols: ["goudronne", "terre"],
};

// échelles des curseurs : fines là où ça compte, plus larges au-delà ; Infinity = « et plus »
const pas = (de: number, a: number, p: number) => Array.from({ length: Math.round((a - de) / p) + 1 }, (_, i) => Math.round((de + i * p) * 10) / 10);
const ECH_PENTE = [...pas(4, 20, 0.5), Infinity];
const ECH_RAIDE = [...pas(4, 30, 1), Infinity];
const ECH_LONGUEUR = [...pas(0, 1000, 50), ...pas(1100, 2000, 100), 2500, 3000, 4000, 5000, Infinity];
const ECH_DPLUS = [...pas(0, 100, 5), ...pas(110, 200, 10), ...pas(250, 500, 50), ...pas(600, 1000, 100), Infinity];
const ECH_RAYON = [...pas(0.5, 5, 0.5), ...pas(6, 10, 1), ...pas(12, 20, 2), 25, 30, 40, 50];
const fr = (v: number, d = 1) => nombre(v, v % 1 ? d : 0);
const metres = (v: number) => (v >= 1000 ? `${fr(v / 1000, 1)} km` : `${v} m`);
/** Dernière case de l'échelle (sans maximum) : « 20 % et + ». */
const etPlus = (ech: number[], f: (v: number) => string) => (v: number) => (Number.isFinite(v) ? f(v) : `${f(ech[ech.length - 2])} et +`);
/** « 6,5 à 9 % », « ≥ 6 % », « ≤ 300 m », « Toutes ». */
function resumePlage(ech: number[], b: number, h: number, f: (v: number) => string, tout: string): string {
  const bas = b > 0 ? f(ech[b]) : null;
  const haut = h < ech.length - 1 ? f(ech[h]) : null;
  if (bas && haut) return b === h ? bas : `${bas} à ${haut}`;
  return bas ? `≥ ${bas}` : haut ? `≤ ${haut}` : tout;
}
/** Valeur d'une poignée « maximum » : la dernière case de l'échelle veut dire « sans maximum ». */
const borne = (ech: number[], h: number) => (h >= ech.length - 1 ? undefined : ech[h]);

function Case({ actif }: { actif: boolean }) {
  return (
    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center",
                   borderColor: actif ? C.encre : C.sable, backgroundColor: actif ? C.encre : C.blanc }}>
      {actif && <Text style={{ color: C.fond, fontWeight: "800", fontSize: 14 }}>✓</Text>}
    </View>
  );
}

const SOLS: [Sol, string, string][] = [
  ["goudronne", "Goudronné", "Routes, pistes cyclables : pour l'allure et le fractionné"],
  ["terre", "Non goudronné", "Terre, gravier, herbe : plus proche du trail, plus doux pour les jambes"],
];
const TYPES: [TypeVoie, string, string][] = [
  ["route", "Route", "Routes et pistes cyclables, goudronnées"],
  ["chemin", "Chemin", "Chemins larges, souvent stabilisés"],
  ["sentier", "Sentier", "Sentiers et escaliers"],
];


const NOMBRES: [string, string][] = [["3", "3"], ["5", "5"], ["10", "10"], ["0", "Toutes"]];

/** « 5 meilleures côtes sur 104 », « 12 côtes », « Aucune côte dans le rayon ». */
export function titreResultats(montrees: number, total: number, mot: string): string {
  if (!total) return `Aucune ${mot} dans le rayon`;
  if (montrees < total) return `${montrees === 1 ? `La meilleure ${mot}` : `Les ${montrees} meilleures ${mot}s`} sur ${total}`;
  return `${total} ${mot}${total > 1 ? "s" : ""}`;
}

/** Ordre des résultats et nombre à montrer : dans la recherche comme sur la page des résultats. */
export function ChoixResultats({ f, setF, total, mot }: { f: Filtres; setF: (f: Filtres) => void; total: number; mot: string }) {
  const cle = f.tri ?? "distance";
  const croissant = f.croissant ?? cle === "distance";
  const sens = croissant ? TRIS[cle].croissant : TRIS[cle].decroissant;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[S.fort, { flex: 1 }]}>Trier par</Text>
        <Pressable onPress={() => setF({ ...f, tri: cle, croissant: !croissant })} accessibilityRole="button"
                   accessibilityLabel={`Ordre : ${sens}. Inverser`}
                   style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12,
                            borderRadius: 18, backgroundColor: C.sable }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: C.encre }}>{croissant ? "↑" : "↓"}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.encre }}>{croissant ? "Croissant" : "Décroissant"}</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(Object.keys(TRIS) as CleTri[]).map((k) => {
          const actif = k === cle;
          return (
            <Pressable key={k} onPress={() => setF({ ...f, tri: k, croissant: k === "distance" })} accessibilityRole="tab"
                       aria-selected={actif}
                       style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{TRIS[k].nom}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={S.petit}>{TRIS[cle].nom} : {sens}. Les numéros de la carte suivent cet ordre.</Text>
      <Text style={S.fort}>Combien en afficher ?</Text>
      <Segments options={NOMBRES} valeur={String(f.nombre ?? 0)} onChange={(v) => setF({ ...f, nombre: Number(v) || undefined })} />
      <Text style={S.petit}>
        {f.nombre ? `Les ${f.nombre} premières selon le tri (« ${sens} »)${total ? `, sur ${total} ${mot}${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}` : ""}.`
                  : `Toutes les ${mot}s qui correspondent, dans l'ordre du tri.`}
      </Text>
    </View>
  );
}

/** « Que cherches-tu ? » : les côtes n'apparaissent qu'une fois la recherche lancée. */
export function RechercheCotes({ filtres, toutes, position, mot, onValider }: {
  filtres: Filtres; toutes: Cote[]; position: Position; mot: string; onValider: (f: Filtres) => void;
}) {
  const [f, setF] = useState(filtres);
  const n = useMemo(() => cotesProches(toutes, position, f).length, [toutes, position, f]);
  const parDefaut = JSON.stringify(f) === JSON.stringify(FILTRES_DEFAUT);
  const basculer = (t: TypeVoie) => {
    const groupe: TypeVoie[] = t === "route" ? ["route", "piste cyclable"] : [t]; // pistes cyclables avec les routes
    setF({ ...f, types: f.types.includes(t) ? f.types.filter((x) => !groupe.includes(x)) : [...f.types, ...groupe] });
  };
  return (
    <View style={{ marginTop: 14, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[S.h2, { flex: 1, fontSize: 20 }]} accessibilityRole="header">Que cherches-tu ?</Text>
          <Pressable onPress={() => setF(FILTRES_DEFAUT)} disabled={parDefaut} aria-disabled={parDefaut} accessibilityRole="button" hitSlop={10}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: parDefaut ? C.gris : C.montee }}>Réinitialiser</Text>
          </Pressable>
        </View>
        <Plage etiquette={mot === "descente" ? "Pente moyenne (en descente)" : "Pente moyenne"} valeurs={ECH_PENTE}
               bas={indiceDe(ECH_PENTE, f.penteMin, 0)} haut={indiceDe(ECH_PENTE, f.penteMax, ECH_PENTE.length - 1)}
               format={etPlus(ECH_PENTE, (v) => `${fr(v)} %`)} resume={resumePlage(ECH_PENTE, indiceDe(ECH_PENTE, f.penteMin, 0), indiceDe(ECH_PENTE, f.penteMax, ECH_PENTE.length - 1), (v) => `${fr(v)} %`, "Toutes")}
               onChange={(b, h) => setF({ ...f, penteMin: ECH_PENTE[b], penteMax: borne(ECH_PENTE, h) })}
               raccourcis={[{ nom: "Toutes", bas: 4, haut: Infinity }, { nom: "4 à 6 %", bas: 4, haut: 6 },
                            { nom: "6 à 10 %", bas: 6, haut: 10 }, { nom: "≥ 10 %", bas: 10, haut: Infinity }]}
               aide="Moyenne du pied au sommet. 4 à 6 % : on court, allure soutenue ; 6 à 10 % : côtes classiques, puissance ; ≥ 10 % : souvent marche active, comme en trail de montagne." />
        <Plage etiquette="Passage le plus raide" valeurs={ECH_RAIDE}
               bas={indiceDe(ECH_RAIDE, f.raideMin, 0)} haut={indiceDe(ECH_RAIDE, f.raideMax, ECH_RAIDE.length - 1)}
               format={etPlus(ECH_RAIDE, (v) => `${v} %`)} resume={resumePlage(ECH_RAIDE, indiceDe(ECH_RAIDE, f.raideMin, 0), indiceDe(ECH_RAIDE, f.raideMax, ECH_RAIDE.length - 1), (v) => `${v} %`, "Tous")}
               onChange={(b, h) => setF({ ...f, raideMin: b ? ECH_RAIDE[b] : undefined, raideMax: borne(ECH_RAIDE, h) })}
               raccourcis={[{ nom: "Tous", bas: 4, haut: Infinity }, { nom: "Régulière ≤ 10 %", bas: 4, haut: 10 },
                            { nom: "Avec un mur ≥ 15 %", bas: 15, haut: Infinity }]}
               aide="La pente des 50 m les plus raides. Une côte régulière se court d'un bout à l'autre ; un mur à 15 % et plus oblige souvent à marcher." />
        <Plage etiquette="Longueur" valeurs={ECH_LONGUEUR}
               bas={indiceDe(ECH_LONGUEUR, f.longueurMin, 0)} haut={indiceDe(ECH_LONGUEUR, f.longueurMax, ECH_LONGUEUR.length - 1)}
               format={etPlus(ECH_LONGUEUR, metres)} resume={resumePlage(ECH_LONGUEUR, indiceDe(ECH_LONGUEUR, f.longueurMin, 0), indiceDe(ECH_LONGUEUR, f.longueurMax, ECH_LONGUEUR.length - 1), metres, "Toutes")}
               onChange={(b, h) => setF({ ...f, longueur: undefined, longueurMin: b ? ECH_LONGUEUR[b] : undefined, longueurMax: borne(ECH_LONGUEUR, h) })}
               raccourcis={[{ nom: "Toutes", bas: 0, haut: Infinity }, { nom: "< 300 m", bas: 0, haut: 300 },
                            { nom: "300 à 800 m", bas: 300, haut: 800 }, { nom: "≥ 800 m", bas: 800, haut: Infinity }]}
               aide="Courtes (< 300 m) : répétitions, puissance ; moyennes (300 à 800 m) : séries classiques ; longues (≥ 800 m) : endurance en montée." />
        <Plage etiquette="Dénivelé (D+)" valeurs={ECH_DPLUS}
               bas={indiceDe(ECH_DPLUS, f.dplusMin, 0)} haut={indiceDe(ECH_DPLUS, f.dplusMax, ECH_DPLUS.length - 1)}
               format={etPlus(ECH_DPLUS, (v) => `${v} m`)} resume={resumePlage(ECH_DPLUS, indiceDe(ECH_DPLUS, f.dplusMin, 0), indiceDe(ECH_DPLUS, f.dplusMax, ECH_DPLUS.length - 1), (v) => `${v} m`, "Tout")}
               onChange={(b, h) => setF({ ...f, dplusMin: ECH_DPLUS[b], dplusMax: borne(ECH_DPLUS, h) })}
               raccourcis={[{ nom: "Tout", bas: 0, haut: Infinity }, { nom: "≥ 20 m", bas: 20, haut: Infinity },
                            { nom: "≥ 40 m", bas: 40, haut: Infinity }, { nom: "≥ 80 m", bas: 80, haut: Infinity }]}
               aide="Mètres gagnés du pied au sommet : c'est lui qui compte pour préparer une course (D+ total ÷ D+ de la côte = nombre de montées)." />
        <Plage etiquette="Distance du point de départ" valeurs={ECH_RAYON} unique bas={0}
               haut={indiceDe(ECH_RAYON, f.rayonM / 1000, 9)} format={(v) => `${fr(v)} km`}
               resume={`≤ ${fr(f.rayonM / 1000)} km`}
               onChange={(_, h) => setF({ ...f, rayonM: ECH_RAYON[h] * 1000 })}
               raccourcis={[{ nom: "2 km", bas: 0, haut: 2 }, { nom: "5 km", bas: 0, haut: 5 },
                            { nom: "10 km", bas: 0, haut: 10 }, { nom: "25 km", bas: 0, haut: 25 }]}
               aide="À vol d'oiseau. 2 km : en footing depuis chez toi ; 10 km et plus : en voiture ou à vélo." />
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Sol</Text>
          <View style={{ backgroundColor: C.blanc, borderRadius: 14, overflow: "hidden" }}>
            {SOLS.map(([sol, nom, detail], i) => {
              const sols = f.sols ?? ["goudronne", "terre"];
              const actif = sols.includes(sol);
              return (
                <Pressable key={sol} onPress={() => setF({ ...f, sols: actif ? sols.filter((x) => x !== sol) : [...sols, sol] })}
                           accessibilityRole="checkbox" aria-checked={actif}
                           style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14,
                                    borderTopWidth: i ? 1 : 0, borderTopColor: C.aire }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.fort, { fontWeight: "600" }]}>{nom}</Text>
                    <Text style={S.petit}>{detail}</Text>
                  </View>
                  <Case actif={actif} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Type de voie</Text>
          <View style={{ backgroundColor: C.blanc, borderRadius: 14, overflow: "hidden" }}>
            {TYPES.map(([t, nom, detail], i) => {
              const actif = f.types.includes(t);
              return (
                <Pressable key={t} onPress={() => basculer(t)} accessibilityRole="checkbox" aria-checked={actif}
                           style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14,
                                    borderTopWidth: i ? 1 : 0, borderTopColor: C.aire }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.fort, { fontWeight: "600" }]}>{nom}</Text>
                    <Text style={S.petit}>{detail}</Text>
                  </View>
                  <Case actif={actif} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable onPress={() => setF({ ...f, eviterPassant: !f.eviterPassant })} accessibilityRole="switch"
                   aria-checked={!!f.eviterPassant}
                   style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14,
                            backgroundColor: C.blanc, borderRadius: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={[S.fort, { fontWeight: "600" }]}>Éviter les routes passantes</Text>
            <Text style={S.petit}>Grands axes, routes rapides (≥ 60 km/h) ou à 3 voies et plus</Text>
          </View>
          <Case actif={!!f.eviterPassant} />
        </Pressable>
        <View style={{ gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.sable }}>
          <Text style={[S.h2, { fontSize: 18, marginTop: 12 }]} accessibilityRole="header">Résultats</Text>
          <ChoixResultats f={f} setF={setF} total={n} mot={mot} />
        </View>
        <Pressable onPress={() => onValider(f)} disabled={!n} accessibilityRole="button" style={[S.bouton, { minHeight: 54, opacity: n ? 1 : 0.45 }]}>
          <Text style={[S.boutonTexte, { fontSize: 16 }]}>
            {!n ? `Aucune ${mot} avec ces critères`
              : f.nombre && f.nombre < n ? `Voir ${f.nombre === 1 ? `la meilleure` : `les ${f.nombre} meilleures`} (sur ${n})`
              : `Voir ${n === 1 ? `la ${mot}` : `les ${n} ${mot}s`}`}
          </Text>
        </Pressable>
        {!n && <Text style={S.petit}>Élargis une plage (pente, longueur, D+), la distance, ou ajoute des types de voie et de sol.</Text>}
    </View>
  );
}
