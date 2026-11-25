// Onglet « Côtes » : un point de départ (ma position, une ville, une adresse), un résumé des filtres,
// puis la carte ou la liste des côtes les plus proches (toute la France, chargée autour du départ).

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, Text, useWindowDimensions, View } from "react-native";

import {
  cotesProches, distanceCouverture, distanceDe, enDescente, kmLisibles, meilleures, murDe, NOMS_TRAFIC, RAYON_COUVERTURE_M,
  resumeFiltres, TRIS, TRIS_PROPOSES, trisDe,
  type CleTri, type Cote, type CoteProche, type Filtres, type Sens,
} from "../calcul/cotes.ts";
import { eauPresDesCotes, type PointEau } from "../calcul/eau.ts";
import type { Position } from "../calcul/geo.ts";
import { adresseDe, type Lieu } from "../calcul/geoservices.ts";
import { dureeLisible, tempsTrajets } from "../calcul/trajets.ts";
import { zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente, type Marqueur } from "../composants/Carte.tsx";
import { Icone, nombre, Segments } from "../composants/communs.tsx";
import { CarteHorsLigne } from "../composants/HorsLigne.tsx";
import { BarreDepart, estInconnu, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { pointsEauAutour } from "../pointsEau.ts";
import { C, S } from "../theme.ts";
import { FILTRES_DEFAUT, RechercheCotes, titreResultats } from "./RechercheCotes.tsx";

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

/** Petite pastille de donnée (« +34 m », « chemin ») : une info par pastille, lisible d'un coup d'œil. */
function Pastille({ texte, fort }: { texte: string; fort?: boolean }) {
  return (
    <Text style={{ fontSize: 13, fontWeight: "700", color: fort ? C.monteeFonce : C.encre, overflow: "hidden",
                   backgroundColor: fort ? C.monteeClair : C.aire, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      {texte}
    </Text>
  );
}

function LigneCote({ c, rang, position, allurePlat, onPress, adresse, ici }: {
  c: CoteProche; rang: number; position: Position; allurePlat: number; onPress: () => void; adresse?: string | null; ici: string;
}) {
  const t = tempsTrajets(position, { lat: c.lat, lon: c.lon }, allurePlat);
  const voiture = t.find((x) => x.mode === "voiture")!;
  const course = t.find((x) => x.mode === "course")!;
  const descente = c.sens === "descente";
  const mur = murDe(c);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
               accessibilityLabel={`${descente ? "Descente" : "Côte"} ${rang} : ${Math.round(c.longueur_m)} mètres à ${descente ? "moins " : ""}${c.pente_moy_pct} %, à ${distanceDe(c.distance_m, ici)}${adresse ? `, ${adresse}` : ""}`}
               style={({ pressed }) => [S.ligne, { alignItems: "flex-start", gap: 16, opacity: pressed ? 0.85 : 1 }]}>
      {/* le numéro reprend la couleur de la pente, comme sur la carte : pas de bande sur le côté */}
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: couleurPente(c.pente_moy_pct), alignItems: "center", justifyContent: "center", marginTop: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: C.blanc }}>{rang}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text style={[S.fort, { fontSize: 18 }]}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {descente ? "−" : ""}{nombre(c.pente_moy_pct, 1)} %</Text>
        <Text style={[S.petit, { color: C.encre }]} numberOfLines={1}>{descente ? "Haut : " : ""}{adresse ?? (c.nom || "Adresse en cours…")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Pastille texte={`${descente ? "−" : "+"}${nombre(c.dplus_m)} m`} />
          <Pastille texte={c.type_voie} />
          {c.revetement ? <Pastille texte={c.revetement.replace(" (supposé)", "")} /> : null}
          {mur ? <Pastille fort texte={`mur à ${mur} %`} /> : null}
          {c.trafic === "passant" && <BadgeTrafic />}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "center", gap: 4, paddingLeft: 4 }}>
        <Text style={[S.fort, { fontSize: 17 }]}>{kmLisibles(c.distance_m)}</Text>
        <Text style={S.petit}>de {ici}</Text>
        <Text style={S.petit}>🚗 {dureeLisible(voiture.minutes)}</Text>
        <Text style={S.petit}>🏃 {dureeLisible(course.minutes)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Tri des résultats, toujours visible et posé juste au-dessus de la liste : on voit ce qu'on touche
 * changer sous ses yeux, sans panneau à rouvrir.
 */
function BarreTri({ f, setF, total }: { f: Filtres; setF: (f: Filtres) => void; total: number }) {
  const tris = trisDe(f);
  const nb = String(f.nombre ?? 0);
  const puce = (actif: boolean, texte: string, onPress: () => void, label?: string) => (
    <Pressable key={texte} onPress={onPress} accessibilityRole="tab" aria-selected={actif} accessibilityLabel={label ?? texte}
               style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: "center",
                        backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: actif ? C.fond : C.encre }}>{texte}</Text>
    </Pressable>
  );
  // toucher un critère l'ajoute (ou le retire) ; sa flèche inverse son sens
  const basculer = (k: CleTri) => {
    const deja = tris.find((t) => t.cle === k);
    const suivants = deja ? tris.filter((t) => t.cle !== k) : [...tris.filter((t) => !(tris.length === 1 && t.cle === "distance")), { cle: k, croissant: k === "distance" }];
    setF({ ...f, tris: suivants.length ? suivants : [{ cle: "distance", croissant: true }], tri: undefined, croissant: undefined });
  };
  const inverser = (k: CleTri) => setF({ ...f, tris: tris.map((t) => (t.cle === k ? { ...t, croissant: !t.croissant } : t)), tri: undefined, croissant: undefined });
  return (
    <View style={{ marginTop: 22, gap: 10 }}>
      <Text style={S.fort} accessibilityRole="header">Trier par</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TRIS_PROPOSES.map((k) => {
          const t = tris.find((x) => x.cle === k);
          const nom = k === "distance" ? "Le plus près" : TRIS[k].nom;
          if (!t) return puce(false, nom, () => basculer(k), `Trier aussi par ${nom}`);
          return (
            <View key={k} style={{ flexDirection: "row", borderRadius: 20, backgroundColor: C.encre, overflow: "hidden" }}>
              <Pressable onPress={() => basculer(k)} accessibilityRole="tab" aria-selected accessibilityLabel={`${nom} : retirer ce critère`}
                         style={{ minHeight: 40, paddingLeft: 14, paddingRight: 6, justifyContent: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.fond }}>{nom}</Text>
              </Pressable>
              <Pressable onPress={() => inverser(k)} accessibilityRole="button" accessibilityLabel={`${nom} : ${t.croissant ? TRIS[k].croissant : TRIS[k].decroissant}. Inverser`}
                         style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }}>
                <Text style={{ fontSize: 15, fontWeight: "900", color: C.fond }}>{t.croissant ? "↑" : "↓"}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text style={S.petit}>
        {tris.length === 1 ? `${TRIS[tris[0].cle].nom} : ${tris[0].croissant ? TRIS[tris[0].cle].croissant : TRIS[tris[0].cle].decroissant}. Touche un autre critère pour l'ajouter.`
          : `${tris.map((t) => `${TRIS[t.cle].nom.toLowerCase()} ${t.croissant ? "↑" : "↓"}`).join(" + ")} : les côtes les mieux classées sur tous ces critères à la fois passent devant. Touche un critère choisi pour le retirer, sa flèche pour inverser.`}
      </Text>
      {total > 3 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={[S.petit, { color: C.encre }]}>Afficher</Text>
          {([["3", "3"], ["5", "5"], ["10", "10"], ["0", `Toutes (${total})`]] as const).map(([v, nom]) =>
            puce(nb === v, nom, () => setF({ ...f, nombre: Number(v) || undefined }), v === "0" ? `Afficher toutes, ${total}` : `Afficher ${v}`))}
        </View>
      )}
    </View>
  );
}

/** Tracés dessinés au plus sur la carte : au-delà, la carte devient illisible et lente. */
const CARTE_MAX = 300;

export function HorsZone({ depart, distance, chargement }: { depart: PointDepart; distance: number; chargement: boolean }) {
  if (estInconnu(depart)) {
    return (
      <View style={[S.carte, { gap: 8, padding: 18 }]}>
        <Text style={[S.h2, { fontSize: 19 }]}>D'où pars-tu ?</Text>
        <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
          Touche la barre ci-dessus pour écrire une ville, un code postal ou une adresse, ou le bouton de position pour te localiser.
          L'appli retient ce lieu pour la prochaine fois.
        </Text>
      </View>
    );
  }
  if (chargement) {
    return (
      <View style={[S.carte, { gap: 10, padding: 18, alignItems: "center" }]}>
        <ActivityIndicator color={C.montee} />
        <Text style={S.petit}>Chargement des côtes autour de {depart.nom}…</Text>
      </View>
    );
  }
  return (
    <View style={[S.carte, { gap: 10, padding: 18 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.monteeClair, alignItems: "center", justifyContent: "center" }}>
        <Icone nom="cotes" couleur={C.monteeFonce} />
      </View>
      <Text style={[S.h2, { fontSize: 19 }]}>Pas de côtes autour de {depart.nom}</Text>
      <Text style={[S.petit, { fontSize: 14, lineHeight: 20 }]}>
        Les côtes couvrent toute la France, outre-mer compris{Number.isFinite(distance) ? ` ; la plus proche chargée est à ${kmLisibles(distance)}` : ""}.
        Vérifie ta connexion internet : les côtes sont chargées autour de ton point de départ. Hors de France, il n'y a pas encore de données.
      </Text>
    </View>
  );
}

export function EcranCotes({ toutes, depart, localisation, filtres, setFiltres, onChoisir, allurePlat, onLocaliser,
                             onRecherche, chargement, mode, setMode, resultats, setResultats }: {
  toutes: Cote[]; depart: PointDepart; localisation: Localisation; filtres: Filtres; setFiltres: (f: Filtres) => void;
  onChoisir: (c: CoteProche, rang: number) => void; allurePlat: number; onLocaliser: () => void; onRecherche: () => void;
  onLieu: (l: Lieu) => void; chargement: boolean; mode: Sens; setMode: (m: Sens) => void;
  resultats: boolean; setResultats: (v: boolean) => void;
}) {
  const [vue, setVue] = useState<"carte" | "liste">("carte");
  // sur ordinateur et tablette, la carte prend de la hauteur
  const largeEcran = useWindowDimensions().width >= 900;
  // en passant de la recherche aux résultats (et inversement), on repart du haut de la page :
  // sinon on atterrit au niveau du bouton « Voir », en bas, sans voir la carte ni le tri
  const defilement = useRef<ScrollViewInstance>(null);
  useEffect(() => { defilement.current?.scrollTo({ y: 0, animated: false }); }, [resultats]);
  // « de toi » avec le GPS, sinon le lieu choisi : « 2,3 km de Vannes »
  const ici = depart.gps ? "toi" : depart.nom.split(",")[0];

  // une descente est une côte parcourue depuis le sommet
  const sens = mode;
  const base = useMemo(() => (sens === "descente" ? toutes.map(enDescente) : toutes), [toutes, sens]);
  const mot = sens === "descente" ? "descente" : "côte";
  const position = depart.position;

  const couverture = useMemo(() => distanceCouverture(toutes, position), [toutes, position]);
  const horsZone = estInconnu(depart) || couverture > RAYON_COUVERTURE_M;
  // toutes les côtes qui correspondent, puis les « meilleures » selon le tri et le nombre choisis
  // calcul différé : quand on demande des milliers de côtes, l'écran reste réactif et affiche « Calcul… »
  const filtresCalcul = useDeferredValue(filtres);
  const enCalcul = filtresCalcul !== filtres;
  const trouvees = useMemo(() => cotesProches(base, position, filtresCalcul), [base, position, filtresCalcul]);
  const total = trouvees.length;
  const cotes = useMemo(() => meilleures(trouvees, filtresCalcul), [trouvees, filtresCalcul]);
  // retour du 24/11 (« j'ai demandé les 10 000 côtes, ça a bugué ») : la liste se déroule par 30 et la
  // carte en trace 300 au plus ; dessiner des milliers de cartes et de tracés d'un coup bloquait la page
  const [nbListe, setNbListe] = useState(30);
  useEffect(() => { setNbListe(30); }, [filtresCalcul, position]);
  // aucune côte dans le rayon : on montre quand même les plus proches
  const auDela = useMemo(
    () => (cotes.length || horsZone ? [] : cotesProches(base, position, { ...filtres, rayonM: Infinity }).slice(0, 5)),
    [cotes, base, position, filtres, horsZone],
  );
  const affichees = cotes.length ? cotes : auDela;
  const surCarte = affichees.slice(0, CARTE_MAX);
  const nbFiltres = Number(filtres.penteMin !== FILTRES_DEFAUT.penteMin || filtres.penteMax !== undefined)
    + Number(filtres.rayonM !== FILTRES_DEFAUT.rayonM) + Number(filtres.types.length !== FILTRES_DEFAUT.types.length)
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

  // points d'eau (OpenStreetMap) près du pied ou du sommet des côtes affichées : utile pour les répétitions
  const [eau, setEau] = useState<PointEau[]>([]);
  const cleEau = affichees.slice(0, 15).map((c) => c.id).join("-");
  useEffect(() => {
    let actif = true;
    const premieres = affichees.slice(0, 15);
    if (!premieres.length) { setEau([]); return; }
    pointsEauAutour([position, ...premieres.map((c) => ({ lat: c.lat, lon: c.lon }))])
      .then((p) => { if (actif) setEau(eauPresDesCotes(p, premieres)); });
    return () => { actif = false; };
  }, [cleEau, position.lat, position.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const carte = (
    <Carte hauteur={largeEcran ? 480 : 300} centre={position} position={position} legende={LEGENDE}
           rayonM={cotes.length ? filtres.rayonM : undefined}
           zoom={zoomAjuste([position, ...affichees.slice(0, 10).map((c) => ({ lat: c.lat, lon: c.lon }))], 360, 380, 11, 16)}
           cle={`${position.lat},${position.lon},${affichees.length},${surCarte.slice(0, 40).map((c) => c.id).join("-")}`}
           traces={surCarte.map((c) => ({ id: c.id, couleur: couleurPente(c.pente_moy_pct),
                                           points: c.geometrie.map(([lon, lat]) => ({ lat, lon })) }))}
           marqueurs={[...affichees.slice(0, 15).map((c, i): Marqueur => ({
             id: String(c.id), position: { lat: c.lat, lon: c.lon }, texte: String(i + 1),
             couleur: i === 0 ? C.encre : couleurPente(c.pente_moy_pct),
             label: `Côte ${i + 1}, ${Math.round(c.longueur_m)} mètres à ${c.pente_moy_pct} %`,
             onPress: () => onChoisir(c, i + 1),
           })), ...eau.map((e, i): Marqueur => ({
             id: `eau${i}`, position: e, texte: "💧", couleur: C.descente, label: `Point d'eau${e.nom ? ` : ${e.nom}` : ""}`,
           }))]} />
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={defilement} style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <BarreDepart titre={sens === "descente" ? "Descentes autour de" : "Côtes autour de"} depart={depart} localisation={localisation}
                     onRecherche={onRecherche} onLocaliser={onLocaliser} />

        {!horsZone && (
          <View style={{ marginTop: 12 }}>
            <Segments options={[["montee", "Montées"], ["descente", "Descentes"]]} valeur={mode} onChange={setMode} />
          </View>
        )}

        {horsZone ? (
          <HorsZone depart={depart} distance={couverture} chargement={chargement} />
        ) : !resultats ? (
          <RechercheCotes filtres={filtres} toutes={base} position={position} mot={mot} ici={ici}
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

            <View style={{ marginTop: 16 }}>
              <Segments options={[["carte", "Carte et liste"], ["liste", "Liste seule"]]} valeur={vue} onChange={setVue} />
            </View>

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
            ) : (
              <>
                {vue === "carte" && (
                  <>
                    <View style={{ marginTop: 14 }}>{carte}</View>
                    {eau.length > 0 && (
                      <Text style={[S.petit, { marginTop: 8 }]}>
                        💧 {eau.length} point{eau.length > 1 ? "s" : ""} d'eau potable à moins de 300 m de ces côtes
                        (© contributeurs OpenStreetMap), à vérifier sur place.
                      </Text>
                    )}
                  </>
                )}

                {total > 1 && <BarreTri f={filtres} setF={setFiltres} total={total} />}

                {!cotes.length && auDela.length > 0 && (
                  <Text style={[S.petit, { marginTop: 14 }]}>
                    Rien à moins de {filtres.rayonM / 1000} km avec ces filtres : voici les plus proches.
                  </Text>
                )}
                {enCalcul && (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 14 }}>
                    <ActivityIndicator color={C.montee} /><Text style={S.petit}>Calcul des côtes…</Text>
                  </View>
                )}
                {vue === "carte" && affichees.length > CARTE_MAX && (
                  <Text style={[S.petit, { marginTop: 10 }]}>La carte montre les {CARTE_MAX} premières selon le tri ; la liste les contient toutes.</Text>
                )}
                <View style={{ gap: 12, marginTop: 16, opacity: enCalcul ? 0.5 : 1 }}>
                  {affichees.slice(0, nbListe).map((c, i) => (
                    <LigneCote key={c.id} c={c} rang={i + 1} position={position} allurePlat={allurePlat} ici={ici}
                               adresse={c.adresse || adresses[c.id]} onPress={() => onChoisir(c, i + 1)} />
                  ))}
                </View>
                {affichees.length > nbListe && (
                  <Pressable onPress={() => setNbListe(nbListe + 30)} accessibilityRole="button" style={[S.boutonClair, { marginTop: 14 }]}>
                    <Text style={S.boutonClairTexte}>Voir 30 {mot}s de plus ({nombre(affichees.length - nbListe)} restantes)</Text>
                  </Pressable>
                )}
                {vue === "carte" && <CarteHorsLigne centre={position} nom={depart.nom === "Ma position" ? "ta position" : depart.nom} />}
              </>
            )}
          </>
        )}

        <Text style={[S.petit, { marginTop: 18 }]}>
          Distances à vol d'oiseau, temps estimés ; le détail d'une côte donne l'itinéraire calculé. Altitudes IGN RGE ALTI,
          réseau BD TOPO, adresses BAN (Licence Ouverte) · revêtements et points d'eau © contributeurs OpenStreetMap (ODbL).
        </Text>
      </ScrollView>
    </View>
  );
}
