// S'entraîner → Sortie : « 2 h, environ 13 km, sur du plat », « 10 km vallonné par les chemins » ou
// « 10 km avec 3 côtes ». La boucle est composée sur le téléphone, sans réseau, puis exportée en GPX.

import { useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

import { composerBoucles, pointsBoucle, type Boucle } from "../calcul/boucles.ts";
import type { Modele } from "../calcul/allure.ts";
import { kmLisibles, type Cote, type CoteProche } from "../calcul/cotes.ts";
import { distanceM, type Position } from "../calcul/geo.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { dureeLisible } from "../calcul/trajets.ts";
import { centreDe, zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { Ajusteur, nombre, Segments, Tuiles } from "../composants/communs.tsx";
import { partagerFichier } from "../fichiers.ts";
import { grapheDeZone, zoneDuDepart, ZONES_RESEAU } from "../reseauZones.ts";
import { C, S } from "../theme.ts";

const DPLUS: [string, string][] = [["0", "Libre"], ["100", "100 m"], ["200", "200 m"], ["300", "300 m"]];
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

function exporter(b: Boucle, i: number) {
  const nom = `Boucle ${nombre(b.distance_m / 1000, 1)} km +${b.dplus_m} m (${b.cotes.length} côte${b.cotes.length > 1 ? "s" : ""})`;
  return partagerFichier(`boucle-${i + 1}.gpx`, ecrireGpx(nom, pointsBoucle(b)));
}

export function VueBoucle({ toutes, position, nomDepart, allurePlat, onChoisir, modele, preset }: {
  toutes: Cote[]; position: Position; nomDepart: string; allurePlat: number; onChoisir: (c: CoteProche, rang: number) => void;
  modele: Modele | null; preset?: { km: number; relief: "plat" | "vallonne" | "cotes" };
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
  const [dplus, setDplus] = useState("0");
  const [eviterRoutes, setEviterRoutes] = useState(false);
  const [eviterPassant, setEviterPassant] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Boucle[] | string | null>(null);
  const [choix, setChoix] = useState(0);
  // réglages de la dernière boucle composée : inutile de relancer le même calcul
  const reglages = JSON.stringify([position.lat, position.lon, km, relief, nbCotes, dplus, eviterRoutes, eviterPassant]);
  const [dernier, setDernier] = useState<string | null>(null);
  const aJour = dernier === reglages && resultat !== null;

  const composer = () => {
    setEnCours(true);
    setResultat(null);
    // on laisse l'indicateur s'afficher avant le calcul (0,2 à 2 s, plus au premier chargement de la zone)
    setTimeout(async () => {
      try {
        const zone = zoneDuDepart(position);
        if (!zone) {
          setResultat(`Pas encore de boucles autour de ${nomDepart} : le réseau des chemins est calculé pour ${ZONES_RESEAU.join(", ")}. `
            + "Choisis un départ dans l'une de ces zones avec la barre de recherche.");
          return;
        }
        const g = await grapheDeZone(zone);
        const demande = relief === "cotes"
          ? { nbCotes, dplusVise: Number(dplus) || null }
          : { nbCotes: 0, dplusVise: DPLUS_PAR_KM[relief] * km };
        setResultat(composerBoucles(g, toutes, position, { distanceKm: km, ...demande, eviterRoutes, eviterPassant }));
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
              : relief === "vallonne" ? "Environ 15 m de D+ par km, sans chercher les côtes."
              : "Enchaîne des côtes mesurées de l'appli."}
          </Text>
        </View>
        {relief === "cotes" && <>
          <Ajusteur etiquette="Côtes à enchaîner" valeur={nbCotes} unite="" pas={1} min={1} max={5} onChange={setNbCotes} />
          <View style={{ gap: 6 }}>
            <Text style={[S.fort, { fontWeight: "600" }]}>Dénivelé visé</Text>
            <Segments options={DPLUS} valeur={dplus} onChange={setDplus} />
          </View>
        </>}
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
        <Segments options={resultat.map((_, i) => [String(i), `Boucle ${i + 1}`] as [string, string])} valeur={String(choix)}
                  onChange={(v) => setChoix(Number(v))} />
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
              <Text style={[S.fort, { color: C.monteeFonce }]}>Pour atteindre {dplus} m de D+</Text>
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
          <Pressable onPress={() => exporter(b, choix)} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Envoyer à ma montre (GPX)</Text>
          </Pressable>
          <Text style={S.petit}>
            * À {Math.floor(allureMinKm)}:{String(Math.round((allureMinKm % 1) * 60)).padStart(2, "0")} /km sur le plat, 100 m de D+ comptant
            comme 1 km (« km-effort », la mesure de l'ITRA). Le GPX s'ouvre dans Garmin Connect, Coros, Suunto ou Strava (« Importer un parcours »).
          </Text>
        </View>
      )}
    </View>
  );
}
