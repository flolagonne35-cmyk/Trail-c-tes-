// Trail-côtes : cinq rubriques en bas, chacune répond à une seule question du coureur
//   Aujourd'hui (que faire aujourd'hui ?), Explorer (où courir ?), Programme (comment m'entraîner ?),
//   Courses (quelle course, comment la réussir ?), Mon monde (où j'en suis ?),
// avec leurs sous-onglets toujours visibles en haut ; un écran de détail par côte, et la création du
// coureur au premier lancement. Pas de menu caché : tout est dans les rubriques (voir docs/refonte.md).

import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import parcoursDemo from "./assets/data/parcours_demo.json";
import { Monogramme } from "./src/composants/Monogramme.tsx";
import { EditeurCoureur } from "./src/avatar3d/EditeurCoureur.tsx";
import { CORPS_DEFAUT, corpsPour, type Corps } from "./src/avatar3d/corps.ts";
import { apparenceAleatoire } from "./src/avatar/modele.ts";
import type { CourseInscrite } from "./src/calcul/calendrier.ts";
import { type Cote, type CoteProche, type Filtres, type Sens } from "./src/calcul/cotes.ts";
import type { Lieu } from "./src/calcul/geoservices.ts";
import { PREFERENCES_DEFAUT, type Ravito } from "./src/calcul/nutrition.ts";
import { mesPassages } from "./src/calcul/points.ts";
import { fusionner, modeleAllure } from "./src/calcul/allure.ts";
import type { Parcours } from "./src/calcul/profil.ts";
import {
  BarreHaut, Navigation, SousOnglets, type Destination, type ModeCourses, type ModeExplorer, type ModeMonde, type Onglet, type Page,
} from "./src/composants/communs.tsx";
import { score } from "./src/calcul/points.ts";
import { RechercheLieu } from "./src/composants/RechercheLieu.tsx";
import { EcranAccueil } from "./src/ecrans/Accueil.tsx";
import { EcranBienvenue } from "./src/ecrans/Bienvenue.tsx";
import { EcranCotes, FILTRES_DEFAUT, type Localisation, type PointDepart } from "./src/ecrans/Cotes.tsx";
import { EcranCourse, type VueCourse } from "./src/ecrans/Course.tsx";
import { EcranDetail } from "./src/ecrans/Detail.tsx";
import { EcranEntrainement } from "./src/ecrans/Entrainement.tsx";
import { EcranProgramme } from "./src/ecrans/Programme.tsx";
import { EcranAventure } from "./src/ecrans/Aventure.tsx";
import { EcranCoach } from "./src/ecrans/Coach.tsx";
import { EcranSecurite } from "./src/ecrans/Securite.tsx";
import { JOURJ_DEFAUT, type ReglagesJourJ } from "./src/ecrans/JourJ.tsx";
import { EcranTrouverCourse } from "./src/ecrans/TrouverCourse.tsx";
import { EcranFicheComplete } from "./src/ecrans/FicheComplete.tsx";
import type { CourseProche } from "./src/calcul/agenda.ts";
import { EcranMesCourses } from "./src/ecrans/MesCourses.tsx";
import { EcranNutrition } from "./src/ecrans/Nutrition.tsx";
import { EcranProfil } from "./src/ecrans/Profil.tsx";
import { EcranSources } from "./src/ecrans/Sources.tsx";
import { chargerCourses, enregistrerCourses } from "./src/mesCourses.ts";
import { chargerPlan, enregistrerPlan, type MonPlan } from "./src/monPlan.ts";
import type { PresetSortie } from "./src/ecrans/Plan.tsx";
import { ajouterRecent, chargerRecents } from "./src/lieux.ts";
import { chargerProfil, enregistrerProfil, type Profil } from "./src/profil.ts";
import { C } from "./src/theme.ts";
import { cotesAutour } from "./src/cotesFrance.ts";
import { useEnLigne } from "./src/zoneHorsLigne.ts";

const DEPART_DEFAUT: PointDepart = { position: { lat: 48.1113, lon: -1.68 }, nom: "Rennes", detail: "Point de départ par défaut", gps: false };
const ALLURE_PLAT_MIN_KM = 5.5;
const TITRES: Record<Page, string> = {
  accueil: "Aujourd'hui", cotes: "Explorer", courses: "Ma course", monde: "Mon monde",
  sources: "Données", securite: "Sécurité",
};
const SOUS_EXPLORER: [ModeExplorer, string][] = [["cotes", "Côtes"], ["sorties", "Parcours"], ["seance", "Séance"]];
const SOUS_COURSES: [ModeCourses, string][] = [["trouver", "Trouver"], ["plan", "Mon plan"], ["course", "Jour J"], ["coach", "Coach"]];
const SOUS_MONDE: [ModeMonde, string][] = [["aventure", "Progression"], ["coureur", "Mon coureur"], ["progres", "Mes chronos"]];

function Contenu() {
  const bords = useSafeAreaInsets();
  // ordinateur et grande tablette : barre latérale et colonne centrée
  const { width: largeur } = useWindowDimensions();
  const large = largeur >= 900;
  const [page, setPage] = useState<Page>("accueil");
  const [recherche, setRecherche] = useState(false);
  const [profil, setProfil] = useState<Profil | null | undefined>(undefined); // undefined : en cours de chargement
  const [accueil, setAccueil] = useState<"bienvenue" | "editeur" | null>(null);
  const [edition, setEdition] = useState(false);
  const [apparenceDepart] = useState(apparenceAleatoire);

  const [parcours, setParcours] = useState<Parcours | null>(null);
  const [objectif, setObjectif] = useState("2h45");
  const [ravitos, setRavitos] = useState<Ravito[]>([]);
  const [prefs, setPrefs] = useState(PREFERENCES_DEFAUT);
  const [reglagesJourJ, setReglagesJourJ] = useState<ReglagesJourJ>(JOURJ_DEFAUT);

  const [depart, setDepart] = useState<PointDepart>(DEPART_DEFAUT);
  const [localisation, setLocalisation] = useState<Localisation>("inactive");
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_DEFAUT);
  const [recents, setRecents] = useState<Lieu[]>([]);
  const [detail, setDetail] = useState<{ cote: CoteProche; rang: number } | null>(null);
  const [modeCotes, setModeCotes] = useState<Sens>("montee");
  const [resultatsCotes, setResultatsCotes] = useState(false); // les côtes n'apparaissent qu'après la recherche
  const [modeExplorer, setModeExplorer] = useState<ModeExplorer>("cotes");
  const [modeCourses, setModeCourses] = useState<ModeCourses>("trouver");
  const [modeMonde, setModeMonde] = useState<ModeMonde>("aventure");
  const [ficheCourse, setFicheCourse] = useState<CourseProche | null>(null);
  const [vueCourse, setVueCourse] = useState<{ vue: VueCourse; n: number } | undefined>(undefined);
  const [courses, setCoursesEtat] = useState<CourseInscrite[]>([]);
  const setCourses = (c: CourseInscrite[]) => { setCoursesEtat(c); enregistrerCourses(c); };
  const [monPlan, setMonPlanEtat] = useState<MonPlan>({ cible: null, questionnaire: null });
  // mise à jour partielle à partir de la dernière valeur : deux changements de suite ne s'écrasent pas
  const majPlan = (partiel: Partial<MonPlan>) => setMonPlanEtat((p) => {
    const n = { ...p, ...partiel };
    enregistrerPlan(n);
    return n;
  });
  // séance ou sortie demandée depuis le plan d'entraînement (pré-remplit S'entraîner)
  const [demandeSeance, setDemandeSeance] = useState<{ texte: string; n: number } | null>(null);
  const [demandeSortie, setDemandeSortie] = useState<(PresetSortie & { n: number }) | null>(null);

  useEffect(() => {
    chargerProfil().then((p) => {
      setProfil(p);
      if (!p) setAccueil("bienvenue");
    });
    chargerRecents().then(setRecents);
    chargerCourses().then(setCoursesEtat);
    chargerPlan().then(setMonPlanEtat);
  }, []);
  const changerProfil = (p: Profil) => {
    setProfil(p);
    enregistrerProfil(p).catch(() => undefined);
  };
  const creerProfil = (prenom: string, apparence = apparenceDepart, corps?: Corps) => {
    changerProfil({ prenom, apparence, creeLe: new Date().toISOString(), activites: [], ...(corps ? { corps } : {}) });
    setAccueil(null);
  };

  // dans un cadre (aperçu web, par exemple dans l'appli Claude), le navigateur refuse la position
  // sans rien demander : on le dit tel quel plutôt que « refusée »
  const dansUnCadre = () => Platform.OS === "web" && typeof window !== "undefined" && window.self !== window.top;
  // chaque demande de position porte un numéro : un lieu choisi entre-temps l'emporte
  const demande = useRef(0);
  const choisirLieu = useCallback((l: Lieu) => {
    demande.current += 1;
    setLocalisation("inactive");
    setDepart({ position: { lat: l.lat, lon: l.lon }, nom: l.label, detail: l.detail, gps: false });
    setRecents((r) => ajouterRecent(r, l));
  }, []);
  const localiser = useCallback(async () => {
    const numero = ++demande.current;
    const aJour = () => numero === demande.current;
    setLocalisation("en_cours");
    // certains navigateurs ne répondent jamais à la demande : on abandonne après 8 s
    const delai = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, non) => setTimeout(() => non(new Error("délai")), 8000))]);
    try {
      const { status } = await delai(Location.requestForegroundPermissionsAsync());
      if (status !== "granted") {
        if (aJour()) setLocalisation(dansUnCadre() ? "apercu" : "refusee");
        return;
      }
      const p = await delai(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!aJour()) return;
      setDepart({ position: { lat: p.coords.latitude, lon: p.coords.longitude }, nom: "Ma position",
                  detail: p.coords.accuracy ? `GPS, à ± ${Math.round(p.coords.accuracy)} m` : "GPS", gps: true });
      setLocalisation("inactive");
    } catch {
      if (aJour()) setLocalisation(dansUnCadre() ? "apercu" : "indisponible");
    }
  }, []);

  // première ouverture d'une page qui part d'un lieu : on tente la localisation, sauf si un lieu a déjà été choisi
  const dejaLocalise = useRef(false);
  useEffect(() => {
    const autour = page === "cotes" || (page === "courses" && modeCourses === "trouver");
    if (autour && !dejaLocalise.current && depart === DEPART_DEFAUT) {
      dejaLocalise.current = true;
      localiser();
    }
  }, [page, modeCourses, depart, localiser]);

  // confirmation brève à chaque nouveau point de départ (GPS ou lieu choisi)
  const [annonce, setAnnonce] = useState<string | null>(null);
  useEffect(() => {
    if (depart === DEPART_DEFAUT) return;
    setAnnonce(depart.gps ? `Position mise à jour${depart.detail.includes("±") ? ` (${depart.detail.replace("GPS, à ", "")})` : ""}`
      : `Départ : ${depart.nom}`);
    const t = setTimeout(() => setAnnonce(null), 2500);
    return () => clearTimeout(t);
  }, [depart]);

  // mon allure selon la pente, apprise de mes sorties GPX validées
  const modele = useMemo(() => (profil ? modeleAllure(fusionner(profil.activites.filter((a) => a.statut === "validee").map((a) => a.allures))) : null),
                         [profil]);


  useEffect(() => { setRavitos([]); setReglagesJourJ(JOURJ_DEFAUT); }, [parcours]);

  const aller = (d: Destination) => {
    setDetail(null);
    setRecherche(false);
    if (d.page === "cotes" && (d.mode === "montee" || d.mode === "descente")) { setModeCotes(d.mode); setModeExplorer("cotes"); }
    else if (d.page === "cotes" && d.mode) setModeExplorer(d.mode as ModeExplorer);
    if (d.page === "courses" && d.mode) setModeCourses(d.mode as ModeCourses);
    if (d.page === "monde" && d.mode) setModeMonde(d.mode as ModeMonde);
    setPage(d.page);
  };
  const versSeance = (texte: string) => { setDemandeSeance({ texte, n: Date.now() }); aller({ page: "cotes", mode: "seance" }); };
  const versSortie = (p: PresetSortie) => { setDemandeSortie({ ...p, n: Date.now() }); aller({ page: "cotes", mode: "sorties" }); };
  const versMaCourse = (vue: VueCourse) => { setVueCourse({ vue, n: Date.now() }); aller({ page: "courses", mode: "course" }); };
  const ouvrirCote = (cote: CoteProche, rang: number) => setDetail({ cote, rang });

  // côtes des départements autour du départ (src/cotesFrance.ts), gardées tant qu'un nouveau
  // chargement n'a rien donné (pas de réseau)
  const [COTES, setCotes] = useState<Cote[]>([]);
  const [chargement, setChargement] = useState(true);
  useEffect(() => {
    let actif = true;
    setChargement(true);
    cotesAutour(depart.position).then((r) => {
      if (!actif) return;
      if (r.cotes.length) setCotes(r.cotes);
      setChargement(false);
    });
    return () => { actif = false; };
  }, [depart]);

  const enLigne = useEnLigne();
  if (profil === undefined) return <View style={{ flex: 1, backgroundColor: C.fond }} />;

  // premier lancement (ou personnalisation) : plein écran, sans barre d'onglets
  if (accueil || edition) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fond, paddingTop: bords.top, paddingBottom: bords.bottom }}>
        <StatusBar style="dark" />
        {accueil === "bienvenue" ? (
          <EcranBienvenue onCreer={() => setAccueil("editeur")} onPasser={() => creerProfil("Coureur")} />
        ) : accueil === "editeur" ? (
          <EditeurCoureur prenomInitial="" corpsInitial={CORPS_DEFAUT} achats={[]} titre="Ton profil de coureur" action="C'est parti"
                          onValider={(prenom, corps) => creerProfil(prenom, apparenceDepart, corps)} onAnnuler={() => setAccueil("bienvenue")} />
        ) : profil && (
          <EditeurCoureur prenomInitial={profil.prenom} corpsInitial={profil.corps ?? corpsPour(profil.apparence.silhouette)} achats={profil.achats ?? []}
                          titre="Mon coureur" action="Enregistrer" onAnnuler={() => setEdition(false)}
                          onValider={(prenom, corps) => { changerProfil({ ...profil, prenom, corps }); setEdition(false); }} />
        )}
      </View>
    );
  }
  if (!profil) return null;

  const commun = { toutes: COTES, depart, localisation, onLocaliser: localiser, onRecherche: () => setRecherche(true),
                   onLieu: choisirLieu, chargement, allurePlat: ALLURE_PLAT_MIN_KM, onChoisir: ouvrirCote };
  let ecran;
  if (detail) {
    ecran = <EcranDetail cote={detail.cote} rang={detail.rang} allurePlat={ALLURE_PLAT_MIN_KM} depart={depart.position}
                         nomDepart={depart.nom} retour={() => setDetail(null)}
                         passages={mesPassages(profil.activites, detail.cote)} />;
  } else if (page === "accueil") {
    ecran = <EcranAccueil profil={profil} aller={aller} monPlan={monPlan} allurePlat={ALLURE_PLAT_MIN_KM} mesCourses={courses} position={depart.position}
                          onSeance={versSeance} onSortie={versSortie} onMaCourse={versMaCourse} />;
  } else if (page === "cotes" && modeExplorer === "cotes") {
    ecran = <EcranCotes {...commun} filtres={filtres} setFiltres={setFiltres} mode={modeCotes} setMode={setModeCotes}
                        resultats={resultatsCotes} setResultats={setResultatsCotes} />;
  } else if (page === "courses" && modeCourses === "plan") {
    ecran = <EcranProgramme cible={monPlan.cible} setCible={(cible) => majPlan({ cible })}
                            questionnaire={monPlan.questionnaire} setQuestionnaire={(questionnaire) => majPlan({ questionnaire })}
                            parcours={parcours} onParcours={setParcours} onTrouver={() => setModeCourses("trouver")}
                            modele={modele} allurePlat={ALLURE_PLAT_MIN_KM} onSeance={versSeance} onSortie={versSortie} />;
  } else if (page === "courses" && modeCourses === "coach") {
    ecran = <EcranCoach profil={profil} monPlan={monPlan} allurePlat={ALLURE_PLAT_MIN_KM} />;
  } else if (page === "cotes" || (page === "monde" && modeMonde === "progres")) {
    ecran = <EcranEntrainement {...commun} mode={page === "monde" ? "progres" : modeExplorer === "sorties" ? "boucle" : "seance"}
                               filtres={filtres} activites={profil.activites} modele={modele}
                               onAjouterSortie={() => aller({ page: "monde", mode: "coureur" })}
                               demandeSeance={demandeSeance} demandeSortie={demandeSortie} onSecurite={() => aller({ page: "securite" })} />;
  } else if (page === "courses" && modeCourses === "trouver" && ficheCourse) {
    const c = ficheCourse;
    ecran = <EcranFicheComplete course={c} depart={depart} onRetour={() => setFicheCourse(null)}
                                deja={courses.some((m) => m.id === `agenda-${c.id}` || (m.nom === c.nom && m.date === c.date))}
                                onAjouter={() => setCourses([...courses, {
                                  id: `agenda-${c.id}`, nom: c.nom, date: c.date, lieu: c.commune, distance_km: c.distances_km.at(-1) ?? 0,
                                  dplus_m: c.dplus_m ?? 0, dossard_eur: c.prix_eur?.at(-1) ?? 0, logement_eur: 0, lien: c.site,
                                  statut: "envisagee", objectif: "", temps: "" }])}
                                onPreparer={(cible) => { majPlan({ cible, questionnaire: null }); setFicheCourse(null); aller({ page: "courses", mode: "plan" }); }} />;
  } else if (page === "courses" && modeCourses === "trouver") {
    ecran = <EcranTrouverCourse depart={depart} localisation={localisation} onLocaliser={localiser} onRecherche={() => setRecherche(true)}
                                onOuvrir={setFicheCourse} mesCourses={courses} cible={monPlan.cible}
                                onMesCourses={() => setModeCourses("saison")} onVoirPlan={() => setModeCourses("plan")}
                                onObjectif={(cible) => { majPlan({ cible, questionnaire: null }); setModeCourses("plan"); }} />;
  } else if (page === "courses" && modeCourses === "saison") {
    ecran = <EcranMesCourses courses={courses} setCourses={setCourses} onRetour={() => setModeCourses("trouver")} onPreparer={(c) => {
      if (c.objectif) setObjectif(c.objectif);
      majPlan({ cible: { nom: c.nom, distance_km: c.distance_km, dplus_m: c.dplus_m, date: c.date, site: c.lien || undefined } });
      versMaCourse("jourj");
    }} />;
  } else if (page === "courses") {
    ecran = <EcranCourse key={vueCourse?.n ?? 0} vueInitiale={vueCourse?.vue}
                         parcours={parcours} onParcours={setParcours} onExemple={() => setParcours(parcoursDemo as Parcours)}
                         objectif={objectif} setObjectif={setObjectif}
                         cotes={COTES} position={depart.position} nomDepart={depart.nom} onChoisir={ouvrirCote} modele={modele}
                         cible={monPlan.cible} setCible={(cible) => majPlan({ cible })} onTrouver={() => setModeCourses("trouver")}
                         ravitos={ravitos} prefs={prefs} reglagesJourJ={reglagesJourJ} setReglagesJourJ={setReglagesJourJ}
                         nutrition={(entete, importer) => (
                           <EcranNutrition entete={entete} parcours={parcours} objectif={objectif} setObjectif={setObjectif}
                                           ravitos={ravitos} setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} onPreparer={importer} />
                         )} />;
  } else if (page === "monde" && modeMonde === "aventure") {
    ecran = <EcranAventure profil={profil} setProfil={changerProfil} onAjouterSortie={() => aller({ page: "monde", mode: "coureur" })} />;
  } else if (page === "monde") {
    ecran = <EcranProfil profil={profil} setProfil={changerProfil} cotes={COTES} onPersonnaliser={() => setEdition(true)}
                         onDonnees={() => aller({ page: "sources" })} />;
  } else if (page === "securite") {
    ecran = <EcranSecurite depart={depart} onRetour={() => aller({ page: "accueil" })} />;
  } else {
    ecran = <EcranSources />;
  }
  const avatar = <Monogramme prenom={profil.prenom} />;
  return (
    <View style={{ flex: 1, flexDirection: large ? "row" : "column", backgroundColor: C.fond }}>
      {large && <Navigation laterale actif={page} basSur={0} onChange={(o: Onglet) => aller({ page: o })} />}
      <View style={{ flex: 1, paddingTop: bords.top }}>
      {/* colonne de lecture : jamais plus large qu'une page de magazine, centrée sur grand écran */}
      <View style={{ flex: 1, width: "100%", maxWidth: large ? 880 : 680, alignSelf: "center" }}>
      <StatusBar style="dark" />
      {!detail && (
        <BarreHaut titre={TITRES[page]} onProfil={() => aller({ page: "monde", mode: "aventure" })} avatar={avatar}
                   surProfil={page === "monde" && modeMonde === "aventure"} points={score(profil.activites).valides} />
      )}
      {!detail && page === "cotes" && <SousOnglets options={SOUS_EXPLORER} valeur={modeExplorer} onChange={setModeExplorer} />}
      {!detail && page === "courses" && !ficheCourse && modeCourses !== "saison" && (
        <SousOnglets options={SOUS_COURSES} valeur={modeCourses} onChange={setModeCourses} />
      )}
      {!detail && page === "monde" && <SousOnglets options={SOUS_MONDE} valeur={modeMonde} onChange={setModeMonde} />}
      {!enLigne && (
        <View style={{ backgroundColor: C.encre, paddingHorizontal: 16, paddingVertical: 6 }} accessibilityRole="alert">
          <Text style={{ color: C.blanc, fontSize: 12 }}>
            Hors connexion : seules les zones déjà vues ou gardées s'affichent (côtes, boucles, points d'eau, carte).
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>{ecran}</View>
      </View>
      {!large && <Navigation actif={page} basSur={bords.bottom} onChange={(o: Onglet) => aller({ page: o })} />}
      </View>
      {annonce && (
        <View pointerEvents="none" accessibilityLiveRegion="polite"
              style={{ position: "absolute", bottom: (large ? 32 : 96) + bords.bottom, left: 20, right: 20, alignItems: "center" }}>
          <Text pointerEvents="none" style={{ backgroundColor: C.encre, color: C.fond, fontWeight: "700", fontSize: 14, paddingVertical: 10,
                                              paddingHorizontal: 16, borderRadius: 999, overflow: "hidden" }}>{annonce}</Text>
        </View>
      )}
      {recherche && (
        <View style={{ position: "absolute", left: 0, right: 0, top: bords.top, bottom: 0 }}>
          <RechercheLieu pres={depart.position} recents={recents} onLieu={choisirLieu} onLocaliser={localiser}
                         onFermer={() => setRecherche(false)} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Contenu />
    </SafeAreaProvider>
  );
}
