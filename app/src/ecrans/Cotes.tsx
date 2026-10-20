// Onglet « Côtes » : un point de départ (ma position, une ville, une adresse), un résumé des filtres,
// puis la carte ou la liste des côtes les plus proches. Hors des zones calculées, on le dit clairement.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import {
  cotesProches, distanceCouverture, enDescente, kmLisibles, LONGUEURS, NOMS_TRAFIC, RAYON_COUVERTURE_M, resumeFiltres,
  type Cote, type CoteProche, type Filtres, type Longueur, type Sens, type TypeVoie,
} from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { adresseDe, type Lieu } from "../calcul/geoservices.ts";
import { dureeLisible, tempsTrajets } from "../calcul/trajets.ts";
import { zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
import { RechercheLieu } from "../composants/RechercheLieu.tsx";
import { VueBoucle } from "./Boucle.tsx";
import { VueSeance } from "./Seance.tsx";
import { C, S } from "../theme.ts";

export type ModeCotes = Sens | "seance" | "boucle";
export type Localisation = "inactive" | "en_cours" | "refusee" | "indisponible";
export type PointDepart = { position: Position; nom: string; detail: string; gps: boolean };

export const FILTRES_DEFAUT: Filtres = {
  rayonM: 5000, penteMin: 4, types: ["route", "piste cyclable", "chemin", "sentier"], longueur: "toutes", dplusMin: 0, eviterPassant: false,
};
const PENTES: [string, string][] = [["4", "4 %"], ["6", "6 %"], ["8", "8 %"], ["10", "10 %"]];
const DPLUS: [string, string][] = [["0", "Tout"], ["20", "20 m"], ["40", "40 m"], ["80", "80 m"]];
const CATEGORIES: [Longueur, string][] = [["toutes", "Toutes"], ["courtes", "Courtes"], ["moyennes", "Moyennes"], ["longues", "Longues"]];
const RAYONS: [string, string][] = [["2000", "2 km"], ["5000", "5 km"], ["10000", "10 km"], ["25000", "25 km"]];
const TYPES: [TypeVoie, string, string][] = [
  ["route", "Route", "Routes et pistes cyclables, goudronnées"],
  ["chemin", "Chemin", "Chemins larges, souvent stabilisés"],
  ["sentier", "Sentier", "Sentiers et escaliers"],
];

const LEGENDE: [string, string][] = [[C.monteeDouce, "< 7 %"], [C.montee, "7 – 10 %"], [C.monteeFonce, "≥ 10 %"]];

function PanneauFiltres({ filtres, toutes, position, onValider, onFermer }: {
  filtres: Filtres; toutes: Cote[]; position: Position; onValider: (f: Filtres) => void; onFermer: () => void;
}) {
  const [f, setF] = useState(filtres);
  const n = useMemo(() => cotesProches(toutes, position, f).length, [toutes, position, f]);
  const basculer = (t: TypeVoie) => {
    const groupe: TypeVoie[] = t === "route" ? ["route", "piste cyclable"] : [t]; // pistes cyclables avec les routes
    setF({ ...f, types: f.types.includes(t) ? f.types.filter((x) => !groupe.includes(x)) : [...f.types, ...groupe] });
  };
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#1B2A2266",
                   justifyContent: "flex-end" }}>
      <Pressable style={{ flex: 1 }} onPress={onFermer} accessibilityLabel="Fermer les filtres" />
      <ScrollView style={{ backgroundColor: C.fond, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "78%" }}
                  contentContainerStyle={{ padding: 20, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[S.h2, { flex: 1, fontSize: 20 }]} accessibilityRole="header">Filtres</Text>
          <Pressable onPress={() => setF(FILTRES_DEFAUT)} accessibilityRole="button" hitSlop={10}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>Réinitialiser</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Pente moyenne minimale</Text>
          <Segments options={PENTES} valeur={String(f.penteMin)} onChange={(v) => setF({ ...f, penteMin: Number(v) })} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Longueur</Text>
          <Segments options={CATEGORIES} valeur={f.longueur ?? "toutes"} onChange={(longueur) => setF({ ...f, longueur })} />
          <Text style={S.petit}>{f.longueur && f.longueur !== "toutes" ? LONGUEURS[f.longueur].detail : "Courtes < 300 m · moyennes 300 à 800 m · longues ≥ 800 m"}</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Dénivelé minimum</Text>
          <Segments options={DPLUS} valeur={String(f.dplusMin ?? 0)} onChange={(v) => setF({ ...f, dplusMin: Number(v) })} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Distance du point de départ</Text>
          <Segments options={RAYONS} valeur={String(f.rayonM)} onChange={(v) => setF({ ...f, rayonM: Number(v) })} />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={S.fort}>Type de voie</Text>
          <View style={{ backgroundColor: C.blanc, borderRadius: 14, overflow: "hidden" }}>
            {TYPES.map(([t, nom, detail], i) => {
              const actif = f.types.includes(t);
              return (
                <Pressable key={t} onPress={() => basculer(t)} accessibilityRole="checkbox" accessibilityState={{ checked: actif }}
                           style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14,
                                    borderTopWidth: i ? 1 : 0, borderTopColor: C.aire }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.fort, { fontWeight: "600" }]}>{nom}</Text>
                    <Text style={S.petit}>{detail}</Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center",
                                 borderColor: actif ? C.encre : C.sable, backgroundColor: actif ? C.encre : C.blanc }}>
                    {actif && <Text style={{ color: C.fond, fontWeight: "800", fontSize: 14 }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Pressable onPress={() => setF({ ...f, eviterPassant: !f.eviterPassant })} accessibilityRole="switch"
                   accessibilityState={{ checked: !!f.eviterPassant }}
                   style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14,
                            backgroundColor: C.blanc, borderRadius: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={[S.fort, { fontWeight: "600" }]}>Éviter les routes passantes</Text>
            <Text style={S.petit}>Grands axes, routes rapides (≥ 60 km/h) ou à 3 voies et plus</Text>
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center",
                         borderColor: f.eviterPassant ? C.encre : C.sable, backgroundColor: f.eviterPassant ? C.encre : C.blanc }}>
            {f.eviterPassant && <Text style={{ color: C.fond, fontWeight: "800", fontSize: 14 }}>✓</Text>}
          </View>
        </Pressable>
      </ScrollView>
      <View style={{ backgroundColor: C.fond, padding: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.sable }}>
        <Pressable onPress={() => { onValider(f); onFermer(); }} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>{n ? `Voir ${n} résultat${n > 1 ? "s" : ""}` : "Aucun résultat avec ces filtres"}</Text>
        </Pressable>
      </View>
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

function HorsZone({ depart, distance, zones, onLieu }: { depart: PointDepart; distance: number; zones: Lieu[]; onLieu: (l: Lieu) => void }) {
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
      {zones.map((z) => (
        <Pressable key={z.label} onPress={() => onLieu(z)} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>Voir les côtes de {z.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function EcranCotes({ toutes, depart, localisation, filtres, setFiltres, onChoisir, allurePlat, onLocaliser,
                             onLieu, recents, zones, source, mode, setMode }: {
  toutes: Cote[]; depart: PointDepart; localisation: Localisation; filtres: Filtres; setFiltres: (f: Filtres) => void;
  onChoisir: (c: CoteProche, rang: number) => void; allurePlat: number; onLocaliser: () => void; onLieu: (l: Lieu) => void;
  recents: Lieu[]; zones: Lieu[]; source: string; mode: ModeCotes; setMode: (m: ModeCotes) => void;
}) {
  const [vue, setVue] = useState<"carte" | "liste">("carte");

  // une descente est une côte parcourue depuis le sommet
  const sens: Sens = mode === "descente" ? "descente" : "montee";
  const base = useMemo(() => (sens === "descente" ? toutes.map(enDescente) : toutes), [toutes, sens]);
  const mot = sens === "descente" ? "descente" : "côte";
  const [panneau, setPanneau] = useState<"recherche" | "filtres" | null>(null);
  const position = depart.position;

  // confirmation brève à chaque nouveau point de départ (GPS ou lieu choisi)
  const [annonce, setAnnonce] = useState<string | null>(null);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    setAnnonce(depart.gps ? `Position mise à jour${depart.detail.includes("±") ? ` (${depart.detail.replace("GPS, à ", "")})` : ""}` : `Départ : ${depart.nom}`);
    const t = setTimeout(() => setAnnonce(null), 2500);
    return () => clearTimeout(t);
  }, [depart]);

  const couverture = useMemo(() => distanceCouverture(toutes, position), [toutes, position]);
  const horsZone = couverture > RAYON_COUVERTURE_M;
  const cotes = useMemo(() => cotesProches(base, position, filtres), [base, position, filtres]);
  // aucune côte dans le rayon : on montre quand même les plus proches
  const auDela = useMemo(
    () => (cotes.length || horsZone ? [] : cotesProches(base, position, { ...filtres, rayonM: Infinity }).slice(0, 5)),
    [cotes, base, position, filtres, horsZone],
  );
  const affichees = cotes.length ? cotes : auDela;
  const nbFiltres = Number(filtres.penteMin !== FILTRES_DEFAUT.penteMin) + Number(filtres.rayonM !== FILTRES_DEFAUT.rayonM)
    + Number(filtres.types.length !== FILTRES_DEFAUT.types.length) + Number((filtres.longueur ?? "toutes") !== "toutes")
    + Number(!!filtres.dplusMin) + Number(!!filtres.eviterPassant);

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

  const sousTitre = localisation === "en_cours" ? "Localisation en cours…"
    : localisation === "refusee" ? "Localisation refusée : cherchez une ville"
    : localisation === "indisponible" ? "Position indisponible : cherchez une ville"
    : depart.detail;

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
        <Text style={[S.surtitre, { marginTop: 12 }]}>Côtes autour de</Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Pressable onPress={() => setPanneau("recherche")} accessibilityRole="search"
                     accessibilityLabel={`Point de départ : ${depart.nom}. Changer`}
                     style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.blanc,
                              borderRadius: 16, paddingHorizontal: 14, minHeight: 56 }}>
            <Icone nom="recherche" couleur={C.gris} taille={20} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: C.encre }} numberOfLines={1}>{depart.nom}</Text>
              <Text style={S.petit} numberOfLines={1}>{sousTitre}</Text>
            </View>
          </Pressable>
          <Pressable onPress={onLocaliser} accessibilityRole="button" accessibilityLabel="Me localiser"
                     style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
                              backgroundColor: depart.gps ? C.montee : C.encre }}>
            {localisation === "en_cours" ? <ActivityIndicator color={C.fond} /> : <Icone nom="position" couleur={C.fond} />}
          </Pressable>
        </View>

        {!horsZone && (
          <View style={{ marginTop: 12 }}>
            <Segments options={[["montee", "Montées"], ["descente", "Descentes"], ["seance", "Séance"], ["boucle", "Boucle"]]}
                      valeur={mode} onChange={setMode} />
          </View>
        )}

        {horsZone ? (
          <HorsZone depart={depart} distance={couverture} zones={zones} onLieu={onLieu} />
        ) : mode === "boucle" ? (
          <VueBoucle toutes={toutes} position={position} nomDepart={depart.nom} allurePlat={allurePlat} onChoisir={onChoisir} />
        ) : mode === "seance" ? (
          <VueSeance toutes={toutes} position={position} filtres={filtres} allurePlat={allurePlat} onChoisir={onChoisir} />
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.fort}>{cotes.length ? `${cotes.length} ${mot}${cotes.length > 1 ? "s" : ""}` : `Aucune ${mot} dans le rayon`}</Text>
                <Text style={S.petit} numberOfLines={1}>{resumeFiltres(filtres)}</Text>
              </View>
              <Pressable onPress={() => setPanneau("filtres")} accessibilityRole="button"
                         accessibilityLabel={`Filtres${nbFiltres ? `, ${nbFiltres} modifiés` : ""}`}
                         style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14,
                                  borderRadius: 12, backgroundColor: nbFiltres ? C.encre : C.sable }}>
                <Icone nom="filtres" couleur={nbFiltres ? C.fond : C.encre} taille={18} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: nbFiltres ? C.fond : C.encre }}>
                  Filtres{nbFiltres ? ` · ${nbFiltres}` : ""}
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 12 }}>
              <Segments options={[["carte", "Carte"], ["liste", "Liste"]]} valeur={vue} onChange={setVue} />
            </View>

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

      {annonce && (
        <View pointerEvents="none" accessibilityLiveRegion="polite"
              style={{ position: "absolute", top: 86, left: 20, right: 20, alignItems: "center" }}>
          <Text style={{ backgroundColor: C.encre, color: C.fond, fontWeight: "700", fontSize: 14, paddingVertical: 10,
                         paddingHorizontal: 16, borderRadius: 999, overflow: "hidden" }}>{annonce}</Text>
        </View>
      )}
      {panneau === "filtres" && (
        <PanneauFiltres filtres={filtres} toutes={base} position={position} onValider={setFiltres} onFermer={() => setPanneau(null)} />
      )}
      {panneau === "recherche" && (
        <RechercheLieu pres={position} recents={recents} zones={zones} onLieu={onLieu} onLocaliser={onLocaliser}
                       onFermer={() => setPanneau(null)} />
      )}
    </View>
  );
}
