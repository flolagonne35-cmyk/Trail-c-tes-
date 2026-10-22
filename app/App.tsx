// Trail-côtes : cinq onglets en bas (Accueil, Côtes, S'entraîner, Course, Nutrition), un menu ☰ qui
// range toutes les sections par catégorie (dont Mes courses, Profil, Données), un écran de détail par
// côte, et la création du coureur au premier lancement.

import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import cotesExportees from "./assets/data/cotes.json";
import parcoursDemo from "./assets/data/parcours_demo.json";
import { Avatar } from "./src/avatar/Avatar.tsx";
import { EditeurAvatar } from "./src/avatar/Editeur.tsx";
import { apparenceAleatoire } from "./src/avatar/modele.ts";
import type { CourseInscrite } from "./src/calcul/calendrier.ts";
import { type Cote, type CoteProche, type Filtres, type Sens } from "./src/calcul/cotes.ts";
import type { Lieu } from "./src/calcul/geoservices.ts";
import { PREFERENCES_DEFAUT, type Ravito } from "./src/calcul/nutrition.ts";
import { mesPassages } from "./src/calcul/points.ts";
import { fusionner, modeleAllure } from "./src/calcul/allure.ts";
import type { Parcours } from "./src/calcul/profil.ts";
import { BarreHaut, Navigation, type Onglet, type Page } from "./src/composants/communs.tsx";
import { Menu, type Destination } from "./src/composants/Menu.tsx";
import { RechercheLieu } from "./src/composants/RechercheLieu.tsx";
import { EcranAccueil } from "./src/ecrans/Accueil.tsx";
import { EcranBienvenue } from "./src/ecrans/Bienvenue.tsx";
import { EcranCotes, FILTRES_DEFAUT, type Localisation, type PointDepart } from "./src/ecrans/Cotes.tsx";
import { EcranCourse } from "./src/ecrans/Course.tsx";
import { EcranDetail } from "./src/ecrans/Detail.tsx";
import { EcranEntrainement, type ModeEntrainement } from "./src/ecrans/Entrainement.tsx";
import { EcranAgenda } from "./src/ecrans/Agenda.tsx";
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

type Donnees = { source: string; zones?: { nom: string; lat: number; lon: number; cotes: number }[]; cotes: Cote[] };
const DONNEES = cotesExportees as unknown as Donnees;
const COTES = DONNEES.cotes;
const SOURCE = DONNEES.source.includes("sqlite") ? "base précalculée" : "zone de Rennes";
// zones dont les côtes sont calculées (proposées dans la recherche et hors zone)
const ZONES: Lieu[] = DONNEES.zones?.length
  ? DONNEES.zones.map((z) => ({ label: z.nom, detail: `${z.cotes} côtes calculées`, lat: z.lat, lon: z.lon }))
  : [{ label: "Rennes", detail: "Rennes et communes proches", lat: 48.1113, lon: -1.68 }];
const DEPART_DEFAUT: PointDepart = { position: { lat: 48.1113, lon: -1.68 }, nom: "Rennes", detail: "Point de départ par défaut", gps: false };
const ALLURE_PLAT_MIN_KM = 5.5;
const TITRES: Record<Page, string> = {
  accueil: "Trail-côtes", cotes: "Côtes et descentes", entrainement: "S'entraîner", course: "Préparer une course",
  nutrition: "Nutrition", agenda: "Courses à venir", courses: "Mes courses", profil: "Profil et sorties", sources: "Données et confidentialité",
};

function Contenu() {
  const bords = useSafeAreaInsets();
  const [page, setPage] = useState<Page>("accueil");
  const [menu, setMenu] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const [profil, setProfil] = useState<Profil | null | undefined>(undefined); // undefined : en cours de chargement
  const [accueil, setAccueil] = useState<"bienvenue" | "editeur" | null>(null);
  const [edition, setEdition] = useState(false);
  const [apparenceDepart] = useState(apparenceAleatoire);

  const [parcours, setParcours] = useState<Parcours | null>(null);
  const [objectif, setObjectif] = useState("2h45");
  const [ravitos, setRavitos] = useState<Ravito[]>([]);
  const [prefs, setPrefs] = useState(PREFERENCES_DEFAUT);

  const [depart, setDepart] = useState<PointDepart>(DEPART_DEFAUT);
  const [localisation, setLocalisation] = useState<Localisation>("inactive");
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_DEFAUT);
  const [recents, setRecents] = useState<Lieu[]>([]);
  const [detail, setDetail] = useState<{ cote: CoteProche; rang: number } | null>(null);
  const [modeCotes, setModeCotes] = useState<Sens>("montee");
  const [resultatsCotes, setResultatsCotes] = useState(false); // les côtes n'apparaissent qu'après la recherche
  const [modeEntrainement, setModeEntrainement] = useState<ModeEntrainement>("seance");
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
  const creerProfil = (prenom: string, apparence = apparenceDepart) => {
    changerProfil({ prenom, apparence, creeLe: new Date().toISOString(), activites: [] });
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
    if ((page === "cotes" || page === "entrainement" || page === "agenda") && !dejaLocalise.current && depart === DEPART_DEFAUT) {
      dejaLocalise.current = true;
      localiser();
    }
  }, [page, depart, localiser]);

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


  useEffect(() => setRavitos([]), [parcours]);

  const aller = (d: Destination) => {
    setDetail(null);
    setMenu(false);
    setRecherche(false);
    if (d.page === "cotes" && d.mode) setModeCotes(d.mode as Sens);
    if (d.page === "entrainement" && d.mode) setModeEntrainement(d.mode as ModeEntrainement);
    setPage(d.page);
  };
  const ouvrirCote = (cote: CoteProche, rang: number) => setDetail({ cote, rang });

  if (profil === undefined) return <View style={{ flex: 1, backgroundColor: C.fond }} />;

  // premier lancement (ou personnalisation) : plein écran, sans barre d'onglets
  if (accueil || edition) {
    return (
      <View style={{ flex: 1, backgroundColor: C.fond, paddingTop: bords.top, paddingBottom: bords.bottom }}>
        <StatusBar style="dark" />
        {accueil === "bienvenue" ? (
          <EcranBienvenue apparence={apparenceDepart} onCreer={() => setAccueil("editeur")} onPasser={() => creerProfil("Coureur")} />
        ) : accueil === "editeur" ? (
          <EditeurAvatar prenomInitial="" apparenceInitiale={apparenceDepart} titre="Mon coureur" action="C'est parti"
                         onValider={(prenom, a) => creerProfil(prenom, a)} onAnnuler={() => setAccueil("bienvenue")} />
        ) : profil && (
          <EditeurAvatar prenomInitial={profil.prenom} apparenceInitiale={profil.apparence} titre="Personnaliser"
                         action="Enregistrer" onAnnuler={() => setEdition(false)}
                         onValider={(prenom, apparence) => { changerProfil({ ...profil, prenom, apparence }); setEdition(false); }} />
        )}
      </View>
    );
  }
  if (!profil) return null;

  const commun = { toutes: COTES, depart, localisation, onLocaliser: localiser, onRecherche: () => setRecherche(true),
                   onLieu: choisirLieu, zones: ZONES, allurePlat: ALLURE_PLAT_MIN_KM, onChoisir: ouvrirCote };
  let ecran;
  if (detail) {
    ecran = <EcranDetail cote={detail.cote} rang={detail.rang} allurePlat={ALLURE_PLAT_MIN_KM} depart={depart.position}
                         nomDepart={depart.nom} retour={() => setDetail(null)}
                         passages={mesPassages(profil.activites, detail.cote)} />;
  } else if (page === "accueil") {
    ecran = <EcranAccueil profil={profil} aller={aller} monPlan={monPlan} depart={depart} allurePlat={ALLURE_PLAT_MIN_KM}
                          onSeance={(texte) => { setDemandeSeance({ texte, n: Date.now() }); aller({ page: "entrainement", mode: "seance" }); }}
                          onSortie={(p) => { setDemandeSortie({ ...p, n: Date.now() }); aller({ page: "entrainement", mode: "boucle" }); }} />;
  } else if (page === "cotes") {
    ecran = <EcranCotes {...commun} filtres={filtres} setFiltres={setFiltres} source={SOURCE} mode={modeCotes} setMode={setModeCotes}
                        resultats={resultatsCotes} setResultats={setResultatsCotes} />;
  } else if (page === "entrainement") {
    ecran = <EcranEntrainement {...commun} mode={modeEntrainement} setMode={setModeEntrainement} filtres={filtres}
                               activites={profil.activites} modele={modele} onAjouterSortie={() => aller({ page: "profil" })}
                               demandeSeance={demandeSeance} demandeSortie={demandeSortie} />;
  } else if (page === "course") {
    ecran = <EcranCourse parcours={parcours} onParcours={setParcours} onExemple={() => setParcours(parcoursDemo as Parcours)}
                         objectif={objectif} setObjectif={setObjectif} onNutrition={() => aller({ page: "nutrition" })}
                         cotes={COTES} position={depart.position} nomDepart={depart.nom} onChoisir={ouvrirCote} modele={modele}
                         cible={monPlan.cible} setCible={(cible) => majPlan({ cible })}
                         questionnaire={monPlan.questionnaire} setQuestionnaire={(questionnaire) => majPlan({ questionnaire })}
                         mesCourses={courses} allurePlat={ALLURE_PLAT_MIN_KM}
                         onSeance={(texte) => { setDemandeSeance({ texte, n: Date.now() }); aller({ page: "entrainement", mode: "seance" }); }}
                         onSortie={(p) => { setDemandeSortie({ ...p, n: Date.now() }); aller({ page: "entrainement", mode: "boucle" }); }} />;
  } else if (page === "nutrition") {
    ecran = <EcranNutrition parcours={parcours} objectif={objectif} setObjectif={setObjectif} ravitos={ravitos} setRavitos={setRavitos}
                            prefs={prefs} setPrefs={setPrefs} onPreparer={() => aller({ page: "course" })} />;
  } else if (page === "agenda") {
    ecran = <EcranAgenda depart={depart} localisation={localisation} onLocaliser={localiser} onRecherche={() => setRecherche(true)}
                         mesCourses={courses} setMesCourses={setCourses}
                         onPreparer={(cible) => { if (cible) majPlan({ cible, questionnaire: null }); aller({ page: "course" }); }} />;
  } else if (page === "courses") {
    ecran = <EcranMesCourses courses={courses} setCourses={setCourses} onPreparer={(c) => {
      if (c.objectif) setObjectif(c.objectif);
      majPlan({ cible: { nom: c.nom, distance_km: c.distance_km, dplus_m: c.dplus_m, date: c.date, site: c.lien || undefined } });
      aller({ page: "course" });
    }} />;
  } else if (page === "profil") {
    ecran = <EcranProfil profil={profil} setProfil={changerProfil} cotes={COTES} onPersonnaliser={() => setEdition(true)} />;
  } else {
    ecran = <EcranSources />;
  }
  const avatar = <Avatar a={profil.apparence} taille={44} cadrage="buste" />;
  return (
    <View style={{ flex: 1, backgroundColor: C.fond, paddingTop: bords.top }}>
      <StatusBar style="dark" />
      {!detail && (
        <BarreHaut titre={TITRES[page]} onMenu={() => setMenu(true)} onProfil={() => aller({ page: "profil" })} avatar={avatar}
                   surProfil={page === "profil"} />
      )}
      <View style={{ flex: 1 }}>{ecran}</View>
      <Navigation actif={detail ? page : page} basSur={bords.bottom} onChange={(o: Onglet) => aller({ page: o })} />
      {annonce && (
        <View pointerEvents="none" accessibilityLiveRegion="polite"
              style={{ position: "absolute", bottom: 96 + bords.bottom, left: 20, right: 20, alignItems: "center" }}>
          <Text pointerEvents="none" style={{ backgroundColor: C.encre, color: C.fond, fontWeight: "700", fontSize: 14, paddingVertical: 10,
                                              paddingHorizontal: 16, borderRadius: 999, overflow: "hidden" }}>{annonce}</Text>
        </View>
      )}
      {recherche && (
        <View style={{ position: "absolute", left: 0, right: 0, top: bords.top, bottom: 0 }}>
          <RechercheLieu pres={depart.position} recents={recents} zones={ZONES} onLieu={choisirLieu} onLocaliser={localiser}
                         onFermer={() => setRecherche(false)} />
        </View>
      )}
      {menu && (
        <View style={{ position: "absolute", left: 0, right: 0, top: bords.top, bottom: 0 }}>
          <Menu actuelle={{ page, mode: page === "cotes" ? modeCotes : page === "entrainement" ? modeEntrainement : undefined }}
                onAller={aller} onFermer={() => setMenu(false)}
                entete={(
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ borderRadius: 24, overflow: "hidden" }}><Avatar a={profil.apparence} taille={48} cadrage="buste" /></View>
                    <View>
                      <Text style={{ fontSize: 17, fontWeight: "800", color: C.encre }}>{profil.prenom}</Text>
                      <Text style={{ fontSize: 12, color: C.gris }}>Trail-côtes</Text>
                    </View>
                  </View>
                )} />
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
