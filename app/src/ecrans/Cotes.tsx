// Onglet « Côtes » : un point de départ (ma position, une ville, une adresse), un résumé des filtres,
// puis la carte ou la liste des côtes les plus proches. Hors des zones calculées, on le dit clairement.

import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  cotesProches, distanceCouverture, enDescente, kmLisibles, NOMS_TRAFIC, RAYON_COUVERTURE_M, resumeFiltres, trierCotes, TRIS,
  type CleTri, type Cote, type CoteProche, type Filtres, type Sens, type Sol, type TypeVoie,
} from "../calcul/cotes.ts";
import { distanceM, type Position } from "../calcul/geo.ts";
import { adresseDe, type Lieu } from "../calcul/geoservices.ts";
import { dureeLisible, tempsTrajets } from "../calcul/trajets.ts";
import { zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
import { CarteHorsLigne } from "../composants/HorsLigne.tsx";
import { indiceDe, Plage } from "../composants/Plage.tsx";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { C, S } from "../theme.ts";

export type { Localisation, PointDepart } from "../composants/BarreDepart.tsx";

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

const LEGENDE: [string, string][] = [[C.monteeDouce, "< 7 %"], [C.montee, "7 – 10 %"], [C.monteeFonce, "≥ 10 %"]];

/** « Que cherches-tu ? » : les côtes n'apparaissent qu'une fois la recherche lancée. */
function RechercheCotes({ filtres, toutes, position, mot, onValider }: {
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
        <Pressable onPress={() => onValider(f)} disabled={!n} accessibilityRole="button" style={[S.bouton, { minHeight: 54, opacity: n ? 1 : 0.45 }]}>
          <Text style={[S.boutonTexte, { fontSize: 16 }]}>{n ? `Voir ${n === 1 ? `la ${mot}` : `les ${n} ${mot}s`}` : `Aucune ${mot} avec ces critères`}</Text>
        </Pressable>
        {!n && <Text style={S.petit}>Élargis une plage (pente, longueur, D+), la distance, ou ajoute des types de voie et de sol.</Text>}
    </View>
  );
}

export function BadgeTrafic() {
  return (
    <Text accessibilityLabel={NOMS_TRAFIC.passant}
          style={{ fontSize: 11, fontWeight: "700", color: C.monteeFonce, backgroundColor: C.monteeClair, borderRadius: 6,
                   paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" }}>⚠ route passante</Text>
  );
}

function LigneCote({ c, rang, position, allurePlat, onPress, adresse }: {
  c: CoteProche; rang: number; position: Position; allurePlat: number; onPress: () => void; adresse?: string | null;
}) {
  const t = tempsTrajets(position, { lat: c.lat, lon: c.lon }, allurePlat);
  const voiture = t.find((x) => x.mode === "voiture")!;
  const course = t.find((x) => x.mode === "course")!;
  const descente = c.sens === "descente";
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
               accessibilityLabel={`${descente ? "Descente" : "Côte"} ${rang} : ${Math.round(c.longueur_m)} mètres à ${descente ? "moins " : ""}${c.pente_moy_pct} %, à ${kmLisibles(c.distance_m)}${adresse ? `, ${adresse}` : ""}`}
               style={[S.ligne, { alignItems: "stretch", paddingLeft: 0, overflow: "hidden" }]}>
      <View style={{ width: 6, backgroundColor: couleurPente(c.pente_moy_pct) }} />
      <View style={{ width: 28, alignItems: "center", paddingTop: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: C.gris }}>{rang}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={S.fort}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {descente ? "−" : ""}{nombre(c.pente_moy_pct, 1)} %</Text>
          {c.trafic === "passant" && <BadgeTrafic />}
        </View>
        <Text style={[S.petit, { color: C.encre, marginTop: 2 }]} numberOfLines={1}>{descente ? "Haut : " : ""}{adresse ?? (c.nom || "Adresse en cours…")}</Text>
        <Text style={[S.petit, { marginTop: 2 }]} numberOfLines={1}>
          {descente ? "−" : "+"}{nombre(c.dplus_m)} m · max {nombre(c.pente_max_pct)} % · {c.type_voie}
          {c.revetement ? ` · ${c.revetement.replace(" (supposé)", "")}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "center", gap: 2 }}>
        <Text style={S.fort}>{kmLisibles(c.distance_m)}</Text>
        <Text style={S.petit}>{dureeLisible(voiture.minutes)} 🚗</Text>
        <Text style={S.petit}>{dureeLisible(course.minutes)} 🏃</Text>
      </View>
    </Pressable>
  );
}

export function HorsZone({ depart, distance, zones, onLieu }: { depart: PointDepart; distance: number; zones: Lieu[]; onLieu: (l: Lieu) => void }) {
  return (
    <View style={[S.carte, { gap: 10, padding: 18 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.monteeClair, alignItems: "center", justifyContent: "center" }}>
        <Icone nom="cotes" couleur={C.monteeFonce} />
      </View>
      <Text style={[S.h2, { fontSize: 19 }]}>Pas encore de côtes autour de {depart.nom}</Text>
      <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
        Chaque côte est mesurée à partir des altitudes IGN, zone par zone. La plus proche est à {kmLisibles(distance)}.
        Cette zone sera calculée dans une prochaine version.
      </Text>
      {[...zones].sort((a, b) => distanceM(depart.position, a) - distanceM(depart.position, b)).slice(0, 2).map((z) => (
        <Pressable key={z.label} onPress={() => onLieu(z)} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>Voir les côtes de {z.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function EcranCotes({ toutes, depart, localisation, filtres, setFiltres, onChoisir, allurePlat, onLocaliser,
                             onRecherche, onLieu, zones, source, mode, setMode, resultats, setResultats }: {
  toutes: Cote[]; depart: PointDepart; localisation: Localisation; filtres: Filtres; setFiltres: (f: Filtres) => void;
  onChoisir: (c: CoteProche, rang: number) => void; allurePlat: number; onLocaliser: () => void; onRecherche: () => void;
  onLieu: (l: Lieu) => void; zones: Lieu[]; source: string; mode: Sens; setMode: (m: Sens) => void;
  resultats: boolean; setResultats: (v: boolean) => void;
}) {
  const [vue, setVue] = useState<"carte" | "liste">("carte");

  // une descente est une côte parcourue depuis le sommet
  const sens = mode;
  const base = useMemo(() => (sens === "descente" ? toutes.map(enDescente) : toutes), [toutes, sens]);
  const mot = sens === "descente" ? "descente" : "côte";
  const position = depart.position;

  const couverture = useMemo(() => distanceCouverture(toutes, position), [toutes, position]);
  const horsZone = couverture > RAYON_COUVERTURE_M;
  // tri des résultats : la plus proche d'abord par défaut ; les autres critères, le plus fort d'abord
  const [tri, setTri] = useState<{ cle: CleTri; croissant: boolean }>({ cle: "distance", croissant: true });
  const cotes = useMemo(() => trierCotes(cotesProches(base, position, filtres), tri.cle, tri.croissant),
                        [base, position, filtres, tri]);
  // aucune côte dans le rayon : on montre quand même les plus proches
  const auDela = useMemo(
    () => (cotes.length || horsZone ? [] : cotesProches(base, position, { ...filtres, rayonM: Infinity }).slice(0, 5)),
    [cotes, base, position, filtres, horsZone],
  );
  const affichees = cotes.length ? cotes : auDela;
  const nbFiltres = Number(filtres.penteMin !== FILTRES_DEFAUT.penteMin || filtres.penteMax !== undefined)
    + Number(filtres.rayonM !== FILTRES_DEFAUT.rayonM) + Number(filtres.types.length !== FILTRES_DEFAUT.types.length)
    + Number(filtres.raideMin !== undefined || filtres.raideMax !== undefined)
    + Number(filtres.longueurMin !== undefined || filtres.longueurMax !== undefined)
    + Number(!!filtres.dplusMin || filtres.dplusMax !== undefined) + Number((filtres.sols ?? ["", ""]).length < 2)
    + Number(!!filtres.eviterPassant);

  // adresses du pied des 10 premières côtes, si le précalcul ne les donne pas (géocodage inverse, mis en cache)
  const [adresses, setAdresses] = useState<Record<number, string | null>>({});
  useEffect(() => {
    let actif = true;
    affichees.slice(0, 10).forEach((c) => {
      if (c.id in adresses || c.adresse) return;
      adresseDe({ lat: c.lat, lon: c.lon }).then((a) => { if (actif) setAdresses((x) => ({ ...x, [c.id]: a })); });
    });
    return () => { actif = false; };
  }, [affichees]); // eslint-disable-line react-hooks/exhaustive-deps

  const carte = (
    <Carte hauteur={vue === "carte" ? 380 : 220} centre={position} position={position}
           rayonM={cotes.length ? filtres.rayonM : undefined}
           zoom={zoomAjuste([position, ...affichees.slice(0, 10).map((c) => ({ lat: c.lat, lon: c.lon }))], 360, 380, 11, 16)}
           cle={`${position.lat},${position.lon},${affichees.map((c) => c.id).join("-")}`}
           traces={affichees.map((c) => ({ id: c.id, couleur: couleurPente(c.pente_moy_pct),
                                           points: c.geometrie.map(([lon, lat]) => ({ lat, lon })) }))}
           marqueurs={affichees.slice(0, 15).map((c, i) => ({
             id: String(c.id), position: { lat: c.lat, lon: c.lon }, texte: String(i + 1),
             couleur: i === 0 ? C.encre : couleurPente(c.pente_moy_pct),
             label: `Côte ${i + 1}, ${Math.round(c.longueur_m)} mètres à ${c.pente_moy_pct} %`,
             onPress: () => onChoisir(c, i + 1),
           }))} />
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <BarreDepart titre={sens === "descente" ? "Descentes autour de" : "Côtes autour de"} depart={depart} localisation={localisation}
                     onRecherche={onRecherche} onLocaliser={onLocaliser} />

        {!horsZone && (
          <View style={{ marginTop: 12 }}>
            <Segments options={[["montee", "Montées"], ["descente", "Descentes"]]} valeur={mode} onChange={setMode} />
          </View>
        )}

        {horsZone ? (
          <HorsZone depart={depart} distance={couverture} zones={zones} onLieu={onLieu} />
        ) : !resultats ? (
          <RechercheCotes filtres={filtres} toutes={base} position={position} mot={mot}
                          onValider={(f) => { setFiltres(f); setResultats(true); }} />
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort}>{cotes.length ? `${cotes.length} ${mot}${cotes.length > 1 ? "s" : ""}` : `Aucune ${mot} dans le rayon`}</Text>
                <Text style={S.petit} numberOfLines={1}>{resumeFiltres(filtres)}</Text>
              </View>
              <Pressable onPress={() => setResultats(false)} accessibilityRole="button"
                         accessibilityLabel={`Modifier la recherche${nbFiltres ? `, ${nbFiltres} critères` : ""}`}
                         style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14,
                                  borderRadius: 12, backgroundColor: C.sable }}>
                <Icone nom="filtres" couleur={C.encre} taille={18} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.encre }}>Modifier</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12 }}>
              <Segments options={[["carte", "Carte"], ["liste", "Liste"]]} valeur={vue} onChange={setVue} />
            </View>

            {cotes.length > 1 && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[S.fort, { flex: 1 }]}>Trier par</Text>
                  <Pressable onPress={() => setTri({ ...tri, croissant: !tri.croissant })} accessibilityRole="button"
                             accessibilityLabel={`Ordre : ${tri.croissant ? TRIS[tri.cle].croissant : TRIS[tri.cle].decroissant}. Inverser`}
                             style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12,
                                      borderRadius: 18, backgroundColor: C.sable }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: C.encre }}>{tri.croissant ? "↑" : "↓"}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.encre }}>{tri.croissant ? "Croissant" : "Décroissant"}</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {(Object.keys(TRIS) as CleTri[]).map((cle) => {
                    const actif = cle === tri.cle;
                    return (
                      <Pressable key={cle} onPress={() => setTri({ cle, croissant: cle === "distance" })} accessibilityRole="tab"
                                 aria-selected={actif}
                                 style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                          backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{TRIS[cle].nom}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={S.petit}>
                  {TRIS[tri.cle].nom} : {tri.croissant ? TRIS[tri.cle].croissant : TRIS[tri.cle].decroissant}. Les numéros de la carte suivent cet ordre.
                </Text>
              </View>
            )}

            {!cotes.length && auDela.length > 0 && (
              <Text style={[S.petit, { marginTop: 10 }]}>
                Rien à moins de {filtres.rayonM / 1000} km avec ces filtres : voici les plus proches.
              </Text>
            )}
            {!affichees.length ? (
              <View style={[S.carte, { gap: 10, padding: 18 }]}>
                <Text style={S.h2}>Aucune côte avec ces filtres</Text>
                <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
                  Aucune côte calculée ici n'atteint {filtres.penteMin} % de pente moyenne sur ces types de voie.
                </Text>
                <Pressable onPress={() => setFiltres(FILTRES_DEFAUT)} accessibilityRole="button" style={S.bouton}>
                  <Text style={S.boutonTexte}>Réinitialiser les filtres</Text>
                </Pressable>
              </View>
            ) : vue === "carte" ? (
              <>
                <View style={{ marginTop: 12 }}>{carte}</View>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8, alignItems: "center" }}>
                  {LEGENDE.map(([couleur, texte]) => (
                    <View key={texte} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 16, height: 5, borderRadius: 3, backgroundColor: couleur }} />
                      <Text style={S.petit}>{texte}</Text>
                    </View>
                  ))}
                  <Text style={[S.petit, { flex: 1, textAlign: "right" }]}>Touchez un numéro</Text>
                </View>
                <CarteHorsLigne centre={position} nom={depart.nom === "Ma position" ? "ta position" : depart.nom} />
                <View style={{ gap: 8, marginTop: 14 }}>
                  {affichees.slice(0, 3).map((c, i) => (
                    <LigneCote key={c.id} c={c} rang={i + 1} position={position} allurePlat={allurePlat}
                               adresse={c.adresse || adresses[c.id]} onPress={() => onChoisir(c, i + 1)} />
                  ))}
                  {affichees.length > 3 && (
                    <Pressable onPress={() => setVue("liste")} accessibilityRole="button" style={S.boutonClair}>
                      <Text style={S.boutonClairTexte}>Voir les {affichees.length} {mot}s</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                {affichees.map((c, i) => (
                  <LigneCote key={c.id} c={c} rang={i + 1} position={position} allurePlat={allurePlat}
                             adresse={c.adresse || adresses[c.id]} onPress={() => onChoisir(c, i + 1)} />
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[S.petit, { marginTop: 18 }]}>
          Distances à vol d'oiseau, temps estimés ; le détail d'une côte donne l'itinéraire calculé. Altitudes IGN RGE ALTI,
          réseau BD TOPO, adresses BAN (Licence Ouverte) · revêtements © contributeurs OpenStreetMap (ODbL) · {source}
        </Text>
      </ScrollView>
    </View>
  );
}
