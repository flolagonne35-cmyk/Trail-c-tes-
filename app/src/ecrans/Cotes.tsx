// Onglet « Côtes » : un point de départ (ma position, une ville, une adresse), un résumé des filtres,
// puis la carte ou la liste des côtes les plus proches. Hors des zones calculées, on le dit clairement.

import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  cotesProches, distanceCouverture, enDescente, kmLisibles, meilleures, NOMS_TRAFIC, RAYON_COUVERTURE_M, resumeFiltres, TRIS,
  type Cote, type CoteProche, type Filtres, type Sens,
} from "../calcul/cotes.ts";
import { distanceM, type Position } from "../calcul/geo.ts";
import { adresseDe, type Lieu } from "../calcul/geoservices.ts";
import { dureeLisible, tempsTrajets } from "../calcul/trajets.ts";
import { zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
import { CarteHorsLigne } from "../composants/HorsLigne.tsx";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { C, S } from "../theme.ts";
import { ChoixResultats, FILTRES_DEFAUT, RechercheCotes, titreResultats } from "./RechercheCotes.tsx";

export type { Localisation, PointDepart } from "../composants/BarreDepart.tsx";
export { FILTRES_DEFAUT } from "./RechercheCotes.tsx";

const LEGENDE: [string, string][] = [[C.monteeDouce, "< 7 %"], [C.montee, "7 – 10 %"], [C.monteeFonce, "≥ 10 %"]];

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
  const [reglerTri, setReglerTri] = useState(false);

  // une descente est une côte parcourue depuis le sommet
  const sens = mode;
  const base = useMemo(() => (sens === "descente" ? toutes.map(enDescente) : toutes), [toutes, sens]);
  const mot = sens === "descente" ? "descente" : "côte";
  const position = depart.position;

  const couverture = useMemo(() => distanceCouverture(toutes, position), [toutes, position]);
  const horsZone = couverture > RAYON_COUVERTURE_M;
  // toutes les côtes qui correspondent, puis les « meilleures » selon le tri et le nombre choisis
  const trouvees = useMemo(() => cotesProches(base, position, filtres), [base, position, filtres]);
  const total = trouvees.length;
  const cotes = useMemo(() => meilleures(trouvees, filtres), [trouvees, filtres]);
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
                <Text style={S.fort}>{titreResultats(cotes.length, total, mot)}</Text>
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

            {total > 1 && (
              <View style={{ marginTop: 12, backgroundColor: C.blanc, borderRadius: 14, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={[S.petit, { flex: 1, color: C.encre }]} numberOfLines={2}>
                    Tri : {TRIS[filtres.tri ?? "distance"].nom.toLowerCase()}, {(filtres.croissant ?? (filtres.tri ?? "distance") === "distance")
                      ? TRIS[filtres.tri ?? "distance"].croissant : TRIS[filtres.tri ?? "distance"].decroissant}
                    {" · "}{filtres.nombre ? `${Math.min(filtres.nombre, total)} affichées` : "toutes affichées"}
                  </Text>
                  <Pressable onPress={() => setReglerTri(!reglerTri)} accessibilityRole="button" aria-expanded={reglerTri}
                             accessibilityLabel={reglerTri ? "Fermer le tri" : "Changer le tri et le nombre affiché"}
                             style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center", backgroundColor: C.sable }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: C.encre }}>{reglerTri ? "Fermer" : "Changer"}</Text>
                  </Pressable>
                </View>
                {reglerTri && <ChoixResultats f={filtres} setF={setFiltres} total={total} mot={mot} />}
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
