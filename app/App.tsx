// Trail-côtes : quatre onglets (Accueil, Côtes, Course, Profil), un écran de détail par côte,
// et la création du coureur au premier lancement.

import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import cotesExportees from "./assets/data/cotes.json";
import parcoursDemo from "./assets/data/parcours_demo.json";
import { EditeurAvatar } from "./src/avatar/Editeur.tsx";
import { apparenceAleatoire } from "./src/avatar/modele.ts";
import { cotesProches, type Cote, type CoteProche, type Filtres } from "./src/calcul/cotes.ts";
import type { Lieu } from "./src/calcul/geoservices.ts";
import { PREFERENCES_DEFAUT, type Ravito } from "./src/calcul/nutrition.ts";
import { mesPassages } from "./src/calcul/points.ts";
import { fusionner, modeleAllure } from "./src/calcul/allure.ts";
import type { Parcours } from "./src/calcul/profil.ts";
import { Navigation, type Onglet } from "./src/composants/communs.tsx";
import { EcranAccueil } from "./src/ecrans/Accueil.tsx";
import { EcranBienvenue } from "./src/ecrans/Bienvenue.tsx";
import { EcranCotes, FILTRES_DEFAUT, type Localisation, type ModeCotes, type PointDepart } from "./src/ecrans/Cotes.tsx";
import { EcranCourse } from "./src/ecrans/Course.tsx";
import { EcranDetail } from "./src/ecrans/Detail.tsx";
import { EcranProfil } from "./src/ecrans/Profil.tsx";
import { ajouterRecent, chargerRecents } from "./src/lieux.ts";
import { chargerProfil, enregistrerProfil, type Profil } from "./src/profil.ts";
import { C } from "./src/theme.ts";

const COTES = (cotesExportees as { source: string; cotes: Cote[] }).cotes;
const SOURCE = (cotesExportees as { source: string }).source.includes("sqlite") ? "base précalculée" : "zone de Rennes";
// zones dont les côtes sont calculées (proposées dans la recherche et hors zone)
const ZONES: Lieu[] = [{ label: "Rennes", detail: "Rennes et communes proches (≈ 9 × 8 km)", lat: 48.1113, lon: -1.68 }];
const DEPART_DEFAUT: PointDepart = { position: { lat: 48.1113, lon: -1.68 }, nom: "Rennes", detail: "Point de départ par défaut", gps: false };
const ALLURE_PLAT_MIN_KM = 5.5;

function Contenu() {
  const bords = useSafeAreaInsets();
  const [onglet, setOnglet] = useState<Onglet>("accueil");
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
  const [modeCotes, setModeCotes] = useState<ModeCotes>("montee");

  useEffect(() => {
    chargerProfil().then((p) => {
      setProfil(p);
      if (!p) setAccueil("bienvenue");
    });
    chargerRecents().then(setRecents);
  }, []);
  const changerProfil = (p: Profil) => {
    setProfil(p);
    enregistrerProfil(p).catch(() => undefined);
  };
  const creerProfil = (prenom: string, apparence = apparenceDepart) => {
    changerProfil({ prenom, apparence, creeLe: new Date().toISOString(), activites: [] });
    setAccueil(null);
  };

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
        if (aJour()) setLocalisation("refusee");
        return;
      }
      const p = await delai(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!aJour()) return;
      setDepart({ position: { lat: p.coords.latitude, lon: p.coords.longitude }, nom: "Ma position",
                  detail: p.coords.accuracy ? `GPS, à ± ${Math.round(p.coords.accuracy)} m` : "GPS", gps: true });
      setLocalisation("inactive");
    } catch {
      if (aJour()) setLocalisation("indisponible");
    }
  }, []);

  // première ouverture de l'onglet Côtes : on tente la localisation, sauf si un lieu a déjà été choisi
  const dejaLocalise = useRef(false);
  useEffect(() => {
    if (onglet === "cotes" && !dejaLocalise.current && depart === DEPART_DEFAUT) {
      dejaLocalise.current = true;
      localiser();
    }
  }, [onglet, depart, localiser]);

  // mon allure selon la pente, apprise de mes sorties GPX validées
  const modele = useMemo(() => (profil ? modeleAllure(fusionner(profil.activites.filter((a) => a.statut === "validee").map((a) => a.allures))) : null),
                         [profil]);

  // l'accueil montre les côtes proches avec les filtres par défaut
  const proches = useMemo(() => cotesProches(COTES, depart.position, { ...FILTRES_DEFAUT, rayonM: 10000 }), [depart]);

  useEffect(() => setRavitos([]), [parcours]);

  const aller = (o: Onglet) => {
    setDetail(null);
    setOnglet(o);
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

  let ecran;
  if (detail) {
    ecran = <EcranDetail cote={detail.cote} rang={detail.rang} allurePlat={ALLURE_PLAT_MIN_KM} depart={depart.position}
                         nomDepart={depart.nom} retour={() => setDetail(null)}
                         passages={mesPassages(profil.activites, detail.cote)} />;
  } else if (onglet === "accueil") {
    ecran = <EcranAccueil profil={profil} proches={proches} lieu={depart.nom} nbCotes={COTES.length} allerA={aller}
                          ouvrirCotes={(m) => { setModeCotes(m); aller("cotes"); }}
                          ouvrirCote={ouvrirCote} />;
  } else if (onglet === "cotes") {
    ecran = <EcranCotes toutes={COTES} depart={depart} localisation={localisation} filtres={filtres} setFiltres={setFiltres}
                        onChoisir={ouvrirCote} allurePlat={ALLURE_PLAT_MIN_KM} onLocaliser={localiser} onLieu={choisirLieu}
                        recents={recents} zones={ZONES} source={SOURCE} mode={modeCotes} setMode={setModeCotes} />;
  } else if (onglet === "course") {
    ecran = <EcranCourse parcours={parcours} onParcours={setParcours} onExemple={() => setParcours(parcoursDemo as Parcours)}
                         objectif={objectif} setObjectif={setObjectif} ravitos={ravitos} setRavitos={setRavitos}
                         prefs={prefs} setPrefs={setPrefs} cotes={COTES} position={depart.position} nomDepart={depart.nom}
                         onChoisir={ouvrirCote} modele={modele} />;
  } else {
    ecran = <EcranProfil profil={profil} setProfil={changerProfil} cotes={COTES} onPersonnaliser={() => setEdition(true)} modele={modele} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.fond, paddingTop: bords.top }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>{ecran}</View>
      <Navigation actif={detail ? "cotes" : onglet} basSur={bords.bottom} onChange={aller} />
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
