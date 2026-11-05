// Programme → Sorties : « 2 h, environ 13 km, sur du plat », « 10 km vallonné par les chemins » ou
// « 10 km avec 3 côtes ». La boucle est composée sur le téléphone, sans réseau, puis exportée en GPX.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

import { composerBoucles, pointsBoucle, type Boucle } from "../calcul/boucles.ts";
import type { Modele } from "../calcul/allure.ts";
import { kmLisibles, type Cote, type CoteProche } from "../calcul/cotes.ts";
import { eauSurParcours, libelleEau, MARGE_M, type EauSurParcours } from "../calcul/eau.ts";
import { distanceM, type Position } from "../calcul/geo.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { dureeLisible } from "../calcul/trajets.ts";
import { centreDe, zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { CarteHorsLigne } from "../composants/HorsLigne.tsx";
import { Ajusteur, nombre, Segments, Tuiles } from "../composants/communs.tsx";
import { partagerFichier } from "../fichiers.ts";
import { pointsEauAutour } from "../pointsEau.ts";
import { grapheAutour } from "../reseauZones.ts";
import { C, S } from "../theme.ts";

/** Combien de parcours proposer : 3 pour choisir vite, 10 pour varier ses sorties. */
const NOMBRES: [string, string][] = [["3", "3"], ["5", "5"], ["10", "10"]];
type Relief = "plat" | "vallonne" | "cotes";
const RELIEFS: [Relief, string][] = [["plat", "Plat"], ["vallonne", "Vallonné"], ["cotes", "Avec des côtes"]];
// D+ visé par km : plat le moins possible ; vallonné ≈ 15 m/km (un parcours « roulant-vallonné »)
const DPLUS_PAR_KM: Record<Exclude<Relief, "cotes">, number> = { plat: 0, vallonne: 15 };

function Interrupteur({ nom, detail, valeur, onChange }: { nom: string; detail: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text style={[S.fort, { fontWeight: "600" }]}>{nom}</Text>
        <Text style={S.petit}>{detail}</Text>
      </View>
      <Switch value={valeur} onValueChange={onChange} accessibilityLabel={nom} />
    </View>
  );
}

function exporter(b: Boucle, i: number, eau: EauSurParcours[]) {
  const nom = `Boucle ${nombre(b.distance_m / 1000, 1)} km +${b.dplus_m} m (${b.cotes.length} côte${b.cotes.length > 1 ? "s" : ""})`;
  const reperes = eau.map((e) => ({ lat: e.lat, lon: e.lon, nom: `Eau km ${nombre(e.km, 1)}`, detail: libelleEau(e) }));
  return partagerFichier(`boucle-${i + 1}.gpx`, ecrireGpx(nom, pointsBoucle(b), reperes));
}

export function VueBoucle({ toutes, position, nomDepart, allurePlat, onChoisir, modele, preset }: {
  toutes: Cote[]; position: Position; nomDepart: string; allurePlat: number; onChoisir: (c: CoteProche, rang: number) => void;
  modele: Modele | null; preset?: { km: number; relief: "plat" | "vallonne" | "cotes"; dplus_m?: number };
}) {
  // une sortie du plan d'entraînement arrive avec sa distance et son relief
  const [objectif, setObjectif] = useState<"duree" | "distance">(preset ? "distance" : "duree");
  const [heures, setHeures] = useState(1.25);
  const [kmSaisis, setKmSaisis] = useState(preset ? Math.min(40, Math.max(3, preset.km)) : 10);
  const [relief, setRelief] = useState<Relief>(preset?.relief ?? "plat");
  // allure du plat : la mienne (apprise de mes GPX) sinon l'allure par défaut ; un peu plus lente en vallonné
  const allureMinKm = modele ? (modele.secondesParMetre(0) * 1000) / 60 : allurePlat;
  const kmDeDuree = Math.max(3, Math.round((heures * 60) / (allureMinKm * (relief === "plat" ? 1 : 1.08)) * 2) / 2);
  const km = objectif === "duree" ? kmDeDuree : kmSaisis;
  const [nbCotes, setNbCotes] = useState(3);
  // D+ visé (0 = libre) : rempli par la séance du programme (« 12 km avec 300 m de D+ »)
  const [dplus, setDplus] = useState(preset?.dplus_m ?? 0);
  const [nombreParcours, setNombreParcours] = useState("3");
  const [eviterRoutes, setEviterRoutes] = useState(false);
  const [eviterPassant, setEviterPassant] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Boucle[] | string | null>(null);
  const [choix, setChoix] = useState(0);
  // réglages de la dernière boucle composée : inutile de relancer le même calcul
  const reglages = JSON.stringify([position.lat, position.lon, km, relief, nbCotes, dplus, eviterRoutes, eviterPassant, nombreParcours]);
  const [dernier, setDernier] = useState<string | null>(null);
  const aJour = dernier === reglages && resultat !== null;

  const composer = () => {
    setEnCours(true);
    setResultat(null);
    // on laisse l'indicateur s'afficher avant le calcul (0,2 à 2 s, plus au premier chargement de la zone)
    setTimeout(async () => {
      try {
        const g = await grapheAutour(position, km);
        if (!g) {
          setResultat(`Les chemins autour de ${nomDepart} n'ont pas pu être chargés : vérifie ta connexion internet. `
            + "Le réseau couvre toute la France, outre-mer compris.");
          return;
        }
        const demande = relief === "cotes"
          ? { nbCotes, dplusVise: dplus || null }
          : { nbCotes: 0, dplusVise: relief === "vallonne" && dplus ? dplus : DPLUS_PAR_KM[relief] * km };
        setResultat(composerBoucles(g, toutes, position, { distanceKm: km, ...demande, eviterRoutes, eviterPassant }, Number(nombreParcours)));
        setChoix(0);
        setDernier(reglages);
      } catch (e) {
        setResultat(e instanceof Error ? e.message : String(e));
      } finally {
        setEnCours(false);
      }
    }, 30);
  };

  const b = Array.isArray(resultat) ? resultat[choix] : null;
  const pts = b ? pointsBoucle(b) : [];
  // points d'eau (OpenStreetMap) le long de la boucle affichée ; null pendant le chargement
  const [eau, setEau] = useState<EauSurParcours[] | null>(null);
  const cleBoucle = b ? `${choix}-${b.distance_m}-${pts[0]?.lat}-${pts[0]?.lon}` : "";
  useEffect(() => {
    if (!b) return;
    let actif = true;
    setEau(null);
    const trace = pointsBoucle(b);
    pointsEauAutour(trace).then((p) => { if (actif) setEau(eauSurParcours(p, trace)); });
    return () => { actif = false; };
  }, [cleBoucle]); // eslint-disable-line react-hooks/exhaustive-deps
  // temps : allure du plat sur la distance, + 1 min par 10 m de D+ (règle des « km-effort » : 100 m de D+ ≈ 1 km)
  const minutes = b ? (b.distance_m / 1000 + b.dplus_m / 100) * allureMinKm : 0;

  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <View style={[S.carte, { marginTop: 0, gap: 12 }]}>
        <Text style={S.petit}>Départ et arrivée : {nomDepart} (ta voiture, ta porte). Change-le avec la barre de recherche.</Text>
        <Segments options={[["duree", "Une durée"], ["distance", "Une distance"]]} valeur={objectif} onChange={setObjectif} />
        {objectif === "duree" ? (
          <>
            <Ajusteur etiquette="Durée" valeur={heures} unite="h" pas={0.25} min={0.5} max={6} onChange={setHeures} />
            <Text style={S.petit}>
              ≈ {nombre(kmDeDuree, 1)} km à {Math.floor(allureMinKm)}:{String(Math.round((allureMinKm % 1) * 60)).padStart(2, "0")} /km
              {modele ? " (ton allure, apprise de tes sorties)" : " (allure par défaut ; ajoute tes sorties GPX pour la tienne)"}.
            </Text>
          </>
        ) : (
          <Ajusteur etiquette="Distance" valeur={kmSaisis} unite="km" pas={1} min={3} max={40} onChange={setKmSaisis} />
        )}
        <View style={{ gap: 6 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Relief</Text>
          <Segments options={RELIEFS} valeur={relief} onChange={setRelief} />
          <Text style={S.petit}>
            {relief === "plat" ? "Le moins de dénivelé possible : sortie d'endurance, allure régulière."
              : relief === "vallonne" ? "Ça monte et ça descend, sans chercher les côtes (environ 15 m de D+ par km si tu ne fixes rien)."
              : "Enchaîne des côtes mesurées de l'appli."}
          </Text>
        </View>
        {relief === "cotes" && (
          <Ajusteur etiquette="Côtes à enchaîner" valeur={nbCotes} unite="" pas={1} min={1} max={5} onChange={setNbCotes} />
        )}
        {relief !== "plat" && (
          <View style={{ gap: 6 }}>
            <Ajusteur etiquette="Dénivelé visé (D+)" valeur={dplus} unite="m" pas={50} min={0} max={2000} onChange={setDplus} />
            <Text style={S.petit}>
              {dplus ? `Les parcours visent ${dplus} m de D+ (± 15 %). En Bretagne, au-delà de 20 m par km, il faut répéter des côtes.`
                : "0 = libre : l'appli prend le relief qui vient."}
            </Text>
          </View>
        )}
        <View style={{ gap: 6 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Combien de parcours me proposer ?</Text>
          <Segments options={NOMBRES} valeur={nombreParcours} onChange={setNombreParcours} />
          <Text style={S.petit}>3 pour choisir vite ; 10 pour varier tes sorties de la semaine. Plus il y en a, plus le calcul est long.</Text>
        </View>
        <Interrupteur nom="Le moins de route possible" detail="Préfère chemins, sentiers et voies vertes" valeur={eviterRoutes} onChange={setEviterRoutes} />
        <Interrupteur nom="Éviter les routes passantes" detail="Grands axes et routes rapides" valeur={eviterPassant} onChange={setEviterPassant} />
        <Pressable onPress={composer} disabled={enCours || aJour} accessibilityRole="button"
                   style={[S.bouton, { flexDirection: "row", gap: 8, opacity: aJour ? 0.45 : 1 }]}>
          {enCours && <ActivityIndicator color={C.fond} />}
          <Text style={S.boutonTexte}>{enCours ? "Calcul de la sortie…" : aJour ? "Sorties à jour : change un réglage" : "Préparer ma sortie"}</Text>
        </Pressable>
      </View>

      {typeof resultat === "string" && <Text style={{ color: C.monteeFonce, fontWeight: "600" }}>{resultat}</Text>}
      {Array.isArray(resultat) && resultat.length === 0 && (
        <Text style={{ color: C.monteeFonce, fontWeight: "600" }}>Aucune boucle trouvée : essaie une autre distance.</Text>
      )}
      {Array.isArray(resultat) && resultat.length > 1 && (
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Text style={S.fort}>{resultat.length} parcours autour de {nomDepart} : touche-en un</Text>
          {resultat.map((x, i) => {
            const actif = i === choix;
            const min = (x.distance_m / 1000 + x.dplus_m / 100) * allureMinKm;
            return (
              <Pressable key={i} onPress={() => setChoix(i)} accessibilityRole="radio" aria-checked={actif}
                         accessibilityLabel={`Parcours ${i + 1} : ${nombre(x.distance_m / 1000, 1)} kilomètres, ${x.dplus_m} mètres de D+`}
                         style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 2,
                                  borderColor: actif ? C.montee : C.blanc, backgroundColor: C.blanc }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                               backgroundColor: actif ? C.montee : C.aire }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: actif ? C.blanc : C.encre }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={S.fort}>{nombre(x.distance_m / 1000, 1)} km · +{nombre(x.dplus_m)} m</Text>
                  <Text style={S.petit}>
                    ≈ {dureeLisible(min)} · {Math.round((1 - x.partRoute) * 100)} % chemins{x.cotes.length ? ` · ${x.cotes.length} côte${x.cotes.length > 1 ? "s" : ""}` : ""}
                    {x.partPassant > 0.02 ? " · ⚠ route passante" : ""}
                  </Text>
                </View>
                {actif && <Text style={{ fontWeight: "800", color: C.montee }}>Choisi</Text>}
              </Pressable>
            );
          })}
        </View>
      )}
      {b && (
        <View style={{ gap: 10 }}>
          <Carte hauteur={320} cle={`boucle-${choix}-${b.distance_m}`} centre={centreDe(pts)} zoom={zoomAjuste(pts, 360, 320, 11, 16)}
                 position={position}
                 traces={b.etapes.map((e, i) => ({ id: 1000 + i, points: e.points, epaisseur: e.type === "cote" ? 6 : 4,
                                                   couleur: e.type === "cote" && e.cote ? couleurPente(e.cote.pente_moy_pct) : C.descente }))}
                 marqueurs={[
                   { id: "dep", position: pts[0], texte: "D", couleur: C.encre, label: "Départ et arrivée" },
                   ...b.cotes.map((c, i) => ({ id: `c${c.id}`, position: { lat: c.lat, lon: c.lon }, texte: String(i + 1),
                                               couleur: couleurPente(c.pente_moy_pct), label: `Côte ${i + 1}`,
                                               onPress: () => onChoisir({ ...c, distance_m: distanceM(position, c) }, i + 1) })),
                   ...(eau ?? []).map((e, i) => ({ id: `eau${i}`, position: e, texte: "💧", couleur: C.descente,
                                                   label: `Point d'eau au km ${nombre(e.km, 1)}` })),
                 ]} />
          <Tuiles valeurs={[["Distance", `${nombre(b.distance_m / 1000, 1)} km`], ["D+", `${nombre(b.dplus_m)} m`],
                            ["Durée*", `≈ ${dureeLisible(minutes)}`]]} />
          {Math.abs(b.ecartDistance) > 0.1 && (
            <Text style={S.petit}>
              {b.ecartDistance < 0 ? "Un peu plus courte" : "Un peu plus longue"} que demandé : c'est la plus proche avec ces côtes.
            </Text>
          )}
          {b.repetitions && (
            <View style={[S.carte, { marginTop: 0, backgroundColor: C.monteeClair, gap: 4 }]}>
              <Text style={[S.fort, { color: C.monteeFonce }]}>Pour atteindre {nombre(dplus)} m de D+</Text>
              <Text style={[S.petit, { color: C.encre }]}>
                Monte {b.repetitions.n} fois de plus la côte de {nombre(b.repetitions.cote.longueur_m)} m (+{nombre(b.repetitions.cote.dplus_m)} m
                chacune) : {kmLisibles(b.repetitions.distanceEnPlus_m)} en plus. Le relief autour de {nomDepart} ne permet pas mieux sans répéter.
              </Text>
            </View>
          )}
          <View style={[S.carte, { marginTop: 0, gap: 6 }]}>
            <Text style={S.petit}>
              {Math.round(b.partRoute * 100)} % de route{b.partPassant > 0.02 ? `, dont ${Math.round(b.partPassant * 100)} % passante ⚠` : ""} ·
              {" "}{Math.round((1 - b.partRoute) * 100)} % chemins, sentiers et pistes{b.partRepassee > 0.1 ? ` · ${Math.round(b.partRepassee * 100)} % sur des rues déjà empruntées` : ""}
            </Text>
            {b.cotes.map((c, i) => (
              <Pressable key={c.id} onPress={() => onChoisir({ ...c, distance_m: distanceM(position, c) }, i + 1)} accessibilityRole="button"
                         style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: couleurPente(c.pente_moy_pct), alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.blanc, fontWeight: "800", fontSize: 12 }}>{i + 1}</Text>
                </View>
                <Text style={[S.fort, { flex: 1 }]} numberOfLines={1}>{nombre(c.longueur_m)} m à {nombre(c.pente_moy_pct, 1)} % · +{nombre(c.dplus_m)} m</Text>
                <Text style={{ color: C.montee, fontWeight: "700" }}>Voir</Text>
              </Pressable>
            ))}
          </View>
          <View style={[S.carte, { marginTop: 0, gap: 6 }]}>
            <Text style={S.fort}>💧 Points d'eau sur le parcours</Text>
            {eau === null && <Text style={S.petit}>Recherche des fontaines…</Text>}
            {eau?.length === 0 && (
              <Text style={S.petit}>
                Aucun point d'eau potable connu à moins de {MARGE_M} m du tracé (ou pas de connexion) : pars avec ce qu'il faut
                (≈ 0,4 à 0,8 L par heure selon la chaleur, voir Nutrition).
              </Text>
            )}
            {eau?.map((e, i) => (
              <Text key={i} style={S.petit}>
                <Text style={{ fontWeight: "700", color: C.descenteFonce }}>km {nombre(e.km, 1)}</Text>
                {" "}· {libelleEau(e)}{e.ecart_m > 30 ? ` · à ${e.ecart_m} m du tracé` : ""}
              </Text>
            ))}
            {!!eau?.length && (
              <Text style={S.petit}>
                Fontaines et robinets d'eau potable signalés par les contributeurs d'OpenStreetMap : vérifie sur place (coupures
                l'hiver, travaux). Ils sont ajoutés au GPX pour ta montre.
              </Text>
            )}
            <Text style={[S.petit, { fontSize: 11 }]}>Données © les contributeurs d'OpenStreetMap (ODbL).</Text>
          </View>
          <Pressable onPress={() => exporter(b, choix, eau ?? [])} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Envoyer à ma montre (GPX)</Text>
          </Pressable>
          <Text style={S.petit}>
            * À {Math.floor(allureMinKm)}:{String(Math.round((allureMinKm % 1) * 60)).padStart(2, "0")} /km sur le plat, 100 m de D+ comptant
            comme 1 km (« km-effort », la mesure de l'ITRA). Le GPX s'ouvre dans Garmin Connect, Coros, Suunto ou Strava (« Importer un parcours »).
          </Text>
        </View>
      )}
      <CarteHorsLigne centre={position} nom={nomDepart} />
    </View>
  );
}
