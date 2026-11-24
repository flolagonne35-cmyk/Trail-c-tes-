// Programme → Parcours : « 2 h, environ 13 km, sur du plat », « 10 km vallonné par les chemins » ou
// « 10 km avec 3 côtes ». La boucle est composée sur le téléphone, sans réseau, puis exportée en GPX.
// Retour du 23/11 (« la feuille de sortie, c'est oppressant ») : trois questions numérotées, chacune
// dans sa carte (départ, durée ou distance, relief), les options repliées ; une fois les parcours
// trouvés, les réglages se replient en une ligne et les parcours passent devant.

import type React from "react";
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
import { C, OMBRE, RUBRIQUES, S } from "../theme.ts";
import { Repli } from "./RechercheCotes.tsx";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { adresseDe } from "../calcul/geoservices.ts";
import { analyserGpx } from "../calcul/parcours.ts";
import type { Parcours } from "../calcul/profil.ts";
import { ProfilParcours } from "../composants/graphiques.tsx";
import { exporterPdf, pageHtml, profilSvg, tableau } from "../pdf.ts";

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

/** Une question du réglage, numérotée, dans sa carte. */
function Etape({ n, titre, children }: { n: number; titre: string; children: React.ReactNode }) {
  const r = RUBRIQUES.cotes;
  return (
    <View style={{ backgroundColor: C.blanc, borderRadius: 22, padding: 18, gap: 14, ...OMBRE }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: r.clair, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "900", color: r.accent }}>{n}</Text>
        </View>
        <Text style={[S.fort, { flex: 1 }]} accessibilityRole="header">{titre}</Text>
      </View>
      {children}
    </View>
  );
}

function exporter(b: Boucle, i: number, eau: EauSurParcours[]) {
  const nom = `Boucle ${nombre(b.distance_m / 1000, 1)} km +${b.dplus_m} m (${b.cotes.length} côte${b.cotes.length > 1 ? "s" : ""})`;
  const reperes = eau.map((e) => ({ lat: e.lat, lon: e.lon, nom: `Eau km ${nombre(e.km, 1)}`, detail: libelleEau(e) }));
  return partagerFichier(`boucle-${i + 1}.gpx`, ecrireGpx(nom, pointsBoucle(b), reperes));
}

export function VueBoucle({ toutes, position, nomDepart, allurePlat, onChoisir, modele, preset, depart, localisation, onRecherche, onLocaliser }: {
  toutes: Cote[]; position: Position; nomDepart: string; allurePlat: number; onChoisir: (c: CoteProche, rang: number) => void;
  modele: Modele | null; preset?: { km: number; relief: "plat" | "vallonne" | "cotes"; dplus_m?: number };
  depart: PointDepart; localisation: Localisation; onRecherche: () => void; onLocaliser: () => void;
}) {
  // adresse exacte du départ (géocodage inverse IGN), affichée et reprise dans le PDF
  const [adresseDepart, setAdresseDepart] = useState<string | null>(null);
  useEffect(() => {
    let actif = true;
    setAdresseDepart(null);
    adresseDe(position).then((a) => { if (actif) setAdresseDepart(a); });
    return () => { actif = false; };
  }, [position.lat, position.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  // une sortie du plan d'entraînement arrive avec sa distance et son relief
  const [objectif, setObjectif] = useState<"duree" | "distance">(preset ? "distance" : "duree");
  const [heures, setHeures] = useState(1.25);
  const [kmSaisis, setKmSaisis] = useState(preset ? Math.min(150, Math.max(3, preset.km)) : 10);
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
  const [reglagesOuverts, setReglagesOuverts] = useState(true);
  const [optionsOuvertes, setOptionsOuvertes] = useState(false);

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
        setReglagesOuverts(false);
      } catch (e) {
        setResultat(e instanceof Error ? e.message : String(e));
      } finally {
        setEnCours(false);
      }
    }, 30);
  };

  const resumeReglages = [
    objectif === "duree" ? `${dureeLisible(heures * 60)} (≈ ${nombre(kmDeDuree, 1)} km)` : `${kmSaisis} km`,
    relief === "cotes" ? `${nbCotes} côte${nbCotes > 1 ? "s" : ""}` : RELIEFS.find(([r]) => r === relief)![1].toLowerCase(),
    dplus && relief !== "plat" ? `${dplus} m de D+` : "", `depuis ${nomDepart}`,
  ].filter(Boolean).join(" · ");
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
  // profil d'altitude de la boucle affichée (altitudes IGN tous les 50 m, montées décrites)
  const [profil, setProfil] = useState<Parcours | null | undefined>(undefined);
  useEffect(() => {
    if (!b) return;
    let actif = true;
    setProfil(undefined);
    analyserGpx(ecrireGpx("Boucle", pointsBoucle(b)), { pasIgn: 50, nom: "Boucle" })
      .then((p) => { if (actif) setProfil(p); }).catch(() => { if (actif) setProfil(null); });
    return () => { actif = false; };
  }, [cleBoucle]); // eslint-disable-line react-hooks/exhaustive-deps
  const montees = profil ? profil.segments.filter((x) => x.type === "montée") : [];
  const exporterBouclePdf = () => {
    if (!b) return;
    const corps = `<div class="chiffres"><div>Distance<b>${nombre(b.distance_m / 1000, 1)} km</b></div><div>D+<b>${nombre(profil?.dplus_m ?? b.dplus_m)} m</b></div>`
      + `<div>Durée estimée<b>≈ ${dureeLisible(minutes)}</b></div>${profil ? `<div>Altitude<b>${profil.alt_min_m} à ${profil.alt_max_m} m</b></div>` : ""}</div>`
      + `<h2>Départ et arrivée</h2><p>${adresseDepart ?? nomDepart} (${position.lat.toFixed(5)}, ${position.lon.toFixed(5)})</p>`
      + (profil ? `<h2>Profil d'altitude</h2>${profilSvg(profil.profil.d_km, profil.profil.z_m)}` : "")
      + (profil?.segments.length ? `<h2>Le parcours, section par section</h2>${tableau(["Km", "Section", "Distance", "Pente moy.", "Altitude", "D+ / D−"],
          profil.segments.map((x) => [`${nombre(x.km_debut, 1)} → ${nombre(x.km_fin, 1)}`, x.type, `${nombre(x.distance_km, 2)} km`,
                                      `${nombre(x.pente_moy_pct, 1)} %`, `${x.alt_debut_m} → ${x.alt_fin_m} m`, `+${x.dplus_m} / −${x.dmoins_m} m`]))}` : "")
      + (b.cotes.length ? `<h2>Côtes</h2>${tableau(["N°", "Longueur", "Pente", "D+"], b.cotes.map((c, i) => [i + 1, `${nombre(c.longueur_m)} m`, `${nombre(c.pente_moy_pct, 1)} %`, `+${nombre(c.dplus_m)} m`]))}` : "")
      + (eau?.length ? `<h2>Points d'eau</h2>${tableau(["Km", "Point d'eau"], eau.map((e) => [nombre(e.km, 1), libelleEau(e)]))}` : "")
      + `<p class="pied">Réseau BD TOPO et altitudes RGE ALTI de l'IGN ; points d'eau © contributeurs OpenStreetMap (ODbL). Le GPX de la boucle s'exporte à part pour la montre.</p>`;
    exporterPdf(pageHtml(`Boucle de ${nombre(b.distance_m / 1000, 1)} km depuis ${nomDepart}`, `${b.cotes.length ? `${b.cotes.length} côte(s) · ` : ""}${Math.round((1 - b.partRoute) * 100)} % de chemins`, corps),
                `boucle-${choix + 1}.pdf`);
  };
  // temps : allure du plat sur la distance, + 1 min par 10 m de D+ (règle des « km-effort » : 100 m de D+ ≈ 1 km)
  const minutes = b ? (b.distance_m / 1000 + b.dplus_m / 100) * allureMinKm : 0;

  return (
    <View style={{ marginTop: 18, gap: 20 }}>
      {!reglagesOuverts ? (
        <Pressable onPress={() => setReglagesOuverts(true)} accessibilityRole="button" accessibilityLabel={`Modifier les réglages : ${resumeReglages}`}
                   style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: RUBRIQUES.cotes.fond, borderRadius: 18, padding: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={S.petit}>Ta sortie</Text>
            <Text style={S.fort} numberOfLines={2}>{resumeReglages}</Text>
          </View>
          <Text style={{ fontWeight: "800", color: RUBRIQUES.cotes.accent }}>Modifier</Text>
        </Pressable>
      ) : (<>
      <Etape n={1} titre="D'où pars-tu ?">
        <BarreDepart titre="Départ et arrivée" depart={depart} localisation={localisation} onRecherche={onRecherche} onLocaliser={onLocaliser} />
        {adresseDepart && <Text style={[S.texte, { fontWeight: "600" }]}>📍 {adresseDepart}</Text>}
        <Text style={S.petit}>Touche la barre pour écrire une ville, un code postal ou une adresse précise (ta porte, un parking), ou le bouton de position. Départ et arrivée au même endroit.</Text>
      </Etape>
      <Etape n={2} titre="Combien de temps, ou combien de km ?">
        <Segments options={[["duree", "Une durée"], ["distance", "Une distance"]]} valeur={objectif} onChange={setObjectif} />
        {objectif === "duree" ? (
          <>
            <Ajusteur etiquette="Durée" valeur={heures} unite="h" pas={0.25} min={0.5} max={24} onChange={setHeures} />
            <Text style={S.petit}>
              ≈ {nombre(kmDeDuree, 1)} km à {Math.floor(allureMinKm)}:{String(Math.round((allureMinKm % 1) * 60)).padStart(2, "0")} /km
              {modele ? " (ton allure, apprise de tes sorties)" : " (allure par défaut ; ajoute tes sorties GPX pour la tienne)"}.
            </Text>
          </>
        ) : (
          <Ajusteur etiquette="Distance" valeur={kmSaisis} unite="km" pas={1} min={3} max={150} onChange={setKmSaisis} />
        )}
        <Text style={S.petit}>Touche le chiffre pour l'écrire. Jusqu'à 150 km ou 24 h : au-delà de 60 km environ, la boucle reste dans un rayon de 30 km autour du départ (elle passe plusieurs fois par les mêmes secteurs).</Text>
      </Etape>
      <Etape n={3} titre="Quel relief ?">
        <Segments options={RELIEFS} valeur={relief} onChange={setRelief} />
        <Text style={S.petit}>
          {relief === "plat" ? "Le moins de dénivelé possible : sortie d'endurance, allure régulière."
            : relief === "vallonne" ? "Ça monte et ça descend, sans chercher les côtes (environ 15 m de D+ par km si tu ne fixes rien)."
            : "Enchaîne des côtes mesurées de l'appli (jusqu'à 20 ; au-delà de 4, elles s'enchaînent de proche en proche)."}
        </Text>
        {relief === "cotes" && (
          <Ajusteur etiquette="Côtes à enchaîner" valeur={nbCotes} unite="" pas={1} min={1} max={20} onChange={setNbCotes} />
        )}
        {relief !== "plat" && (
          <View style={{ gap: 6 }}>
            <Ajusteur etiquette="Dénivelé visé (D+)" valeur={dplus} unite="m" pas={50} min={0} max={10000} onChange={setDplus} />
            <Text style={S.petit}>
              {dplus ? `Les parcours visent ${dplus} m de D+ (± 15 %). En Bretagne, au-delà de 20 m par km, il faut répéter des côtes.`
                : "0 = libre : l'appli prend le relief qui vient."}
            </Text>
          </View>
        )}
      </Etape>
      <Repli titre="Options" ouvert={optionsOuvertes} onBasculer={() => setOptionsOuvertes(!optionsOuvertes)}
             resume={[`${nombreParcours} parcours proposés`, eviterRoutes ? "le moins de route possible" : "", eviterPassant ? "sans routes passantes" : ""].filter(Boolean).join(" · ")}>
        <View style={{ gap: 6 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Combien de parcours me proposer ?</Text>
          <Segments options={NOMBRES} valeur={nombreParcours} onChange={setNombreParcours} />
          <Text style={S.petit}>3 pour choisir vite ; 10 pour varier tes sorties de la semaine. Plus il y en a, plus le calcul est long.</Text>
        </View>
        <Interrupteur nom="Le moins de route possible" detail="Préfère chemins, sentiers et voies vertes" valeur={eviterRoutes} onChange={setEviterRoutes} />
        <Interrupteur nom="Éviter les routes passantes" detail="Grands axes et routes rapides : plus sûr, surtout de nuit (voir la page Sécurité)" valeur={eviterPassant} onChange={setEviterPassant} />
      </Repli>
      <Pressable onPress={composer} disabled={enCours || aJour} accessibilityRole="button"
                 style={[S.bouton, { flexDirection: "row", gap: 8, opacity: aJour ? 0.45 : 1 }]}>
        {enCours && <ActivityIndicator color={C.fond} />}
        <Text style={S.boutonTexte}>{enCours ? "Calcul des parcours…" : aJour ? "Parcours à jour : change un réglage" : "Trouver mes parcours"}</Text>
      </Pressable>
      </>)}

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
                                  borderColor: actif ? RUBRIQUES.cotes.accent : C.blanc, backgroundColor: C.blanc, ...OMBRE }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
                               backgroundColor: actif ? RUBRIQUES.cotes.accent : C.aire }}>
                  <Text style={{ fontWeight: "800", fontSize: 15, color: actif ? C.blanc : C.encre }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={S.fort}>{nombre(x.distance_m / 1000, 1)} km · +{nombre(x.dplus_m)} m</Text>
                  <Text style={S.petit}>
                    ≈ {dureeLisible(min)} · {Math.round((1 - x.partRoute) * 100)} % chemins{x.cotes.length ? ` · ${x.cotes.length} côte${x.cotes.length > 1 ? "s" : ""}` : ""}
                    {x.partPassant > 0.02 ? " · ⚠ route passante" : ""}
                  </Text>
                </View>
                {actif && <Text style={{ fontWeight: "800", color: RUBRIQUES.cotes.accent }}>Choisi</Text>}
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
          <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
            <Text style={S.fort}>Profil d'altitude</Text>
            {profil === undefined && <View style={{ flexDirection: "row", gap: 8 }}><ActivityIndicator color={C.encre} /><Text style={S.petit}>Altitudes IGN du tracé…</Text></View>}
            {profil === null && <Text style={S.petit}>Profil indisponible sans connexion (les altitudes viennent de l'IGN).</Text>}
            {profil && (
              <>
                <ProfilParcours parcours={profil} />
                <Text style={S.petit}>De {profil.alt_min_m} à {profil.alt_max_m} m d'altitude · +{nombre(profil.dplus_m)} m / −{nombre(profil.dmoins_m)} m (altitudes IGN, lissées).</Text>
                {montees.length > 0 && <Text style={[S.fort, { fontSize: 15, marginTop: 4 }]}>Les montées</Text>}
                {montees.map((m) => (
                  <Text key={m.n} style={S.petit}>
                    <Text style={{ fontWeight: "700", color: C.encre }}>km {nombre(m.km_debut, 1)} : {nombre(m.distance_km, m.distance_km < 1 ? 2 : 1)} km à {nombre(m.pente_moy_pct, 1)} %</Text>
                    {" "}de {m.alt_debut_m} à {m.alt_fin_m} m (+{nombre(m.dplus_m)} m){m.pente_max_pct >= 15 ? `, passages à ${Math.round(m.pente_max_pct)} %` : ""}
                  </Text>
                ))}
              </>
            )}
          </View>
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
          <Pressable onPress={exporterBouclePdf} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Fiche PDF (profil, sections, côtes, points d'eau)</Text>
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
