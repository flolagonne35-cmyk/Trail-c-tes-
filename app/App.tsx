// Trail-côtes : parcours segmenté, plan nutrition, côtes à proximité (maquette des 4 écrans).

import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import cotesExportees from "./assets/data/cotes.json";
import parcoursDemo from "./assets/data/parcours_demo.json";
import { cotesProches, type Cote, type CoteProche, type Filtres } from "./src/calcul/cotes.ts";
import type { Position } from "./src/calcul/geo.ts";
import { PREFERENCES_DEFAUT, type Ravito } from "./src/calcul/nutrition.ts";
import type { Parcours } from "./src/calcul/profil.ts";
import { Navigation, type Onglet } from "./src/composants/communs.tsx";
import { EcranCotes } from "./src/ecrans/Cotes.tsx";
import { EcranDetail } from "./src/ecrans/Detail.tsx";
import { EcranMoi } from "./src/ecrans/Moi.tsx";
import { EcranNutrition } from "./src/ecrans/Nutrition.tsx";
import { EcranParcours } from "./src/ecrans/Parcours.tsx";
import { chargerProfil, enregistrerProfil, type Profil } from "./src/profil.ts";
import { C } from "./src/theme.ts";

const RENNES: Position = { lat: 48.1113, lon: -1.68 };
const COTES = (cotesExportees as { source: string; cotes: Cote[] }).cotes;
const ALLURE_PLAT_MIN_KM = 5.5;

function Contenu() {
  const bords = useSafeAreaInsets();
  const [onglet, setOnglet] = useState<Onglet>("parcours");
  const [parcours, setParcours] = useState<Parcours>(parcoursDemo as Parcours);
  const [objectif, setObjectif] = useState("2h45");
  const [ravitos, setRavitos] = useState<Ravito[]>([]);
  const [prefs, setPrefs] = useState(PREFERENCES_DEFAUT);
  const [position, setPosition] = useState<Position>(RENNES);
  const [sourcePosition, setSourcePosition] = useState("position par défaut : Rennes");
  const [filtres, setFiltres] = useState<Filtres>({ rayonM: 5000, penteMin: 5, types: ["route", "piste cyclable", "chemin", "sentier"] });
  const [detail, setDetail] = useState<{ cote: CoteProche; rang: number } | null>(null);
  const [profil, setProfil] = useState<Profil | null | undefined>(undefined); // undefined : en cours de chargement

  useEffect(() => {
    chargerProfil().then((p) => {
      setProfil(p);
      if (!p) setOnglet("moi"); // premier lancement : création de l'avatar
    });
  }, []);
  const changerProfil = (p: Profil) => {
    setProfil(p);
    enregistrerProfil(p).catch(() => undefined);
  };

  // chaque demande de position porte un numéro : un lieu choisi entre-temps l'emporte
  const demande = useRef(0);
  const choisirLieu = useCallback((p: Position, label: string) => {
    demande.current += 1;
    setPosition(p);
    setSourcePosition(label);
  }, []);
  const localiser = useCallback(async () => {
    const numero = ++demande.current;
    const aJour = () => numero === demande.current;
    setSourcePosition("localisation…");
    // certains navigateurs ne répondent jamais à la demande : on abandonne après 8 s
    const delai = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, non) => setTimeout(() => non(new Error("délai")), 8000))]);
    try {
      const { status } = await delai(Location.requestForegroundPermissionsAsync());
      if (status !== "granted") {
        if (aJour()) setSourcePosition("localisation refusée : cherchez une ville ou une adresse");
        return;
      }
      const p = await delai(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!aJour()) return;
      setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
      setSourcePosition(`ma position (± ${Math.round(p.coords.accuracy ?? 0)} m)`);
    } catch {
      if (aJour()) setSourcePosition("position indisponible : cherchez une ville ou une adresse");
    }
  }, []);

  // première ouverture de l'onglet Côtes : on tente la localisation
  const [dejaLocalise, setDejaLocalise] = useState(false);
  useEffect(() => {
    if (onglet === "cotes" && !dejaLocalise) {
      setDejaLocalise(true);
      localiser();
    }
  }, [onglet, dejaLocalise, localiser]);

  const proches = useMemo(() => cotesProches(COTES, position, filtres), [position, filtres]);

  useEffect(() => setRavitos([]), [parcours]);

  let ecran;
  if (detail) {
    ecran = <EcranDetail cote={detail.cote} rang={detail.rang} allurePlat={ALLURE_PLAT_MIN_KM} depart={position}
                         nomDepart={sourcePosition} retour={() => setDetail(null)} />;
  } else if (onglet === "parcours") {
    ecran = <EcranParcours parcours={parcours} onParcours={setParcours} />;
  } else if (onglet === "moi") {
    ecran = profil === undefined ? <View style={{ flex: 1 }} />
      : <EcranMoi profil={profil} setProfil={changerProfil} cotes={COTES} />;
  } else if (onglet === "nutrition") {
    ecran = <EcranNutrition parcours={parcours} objectif={objectif} setObjectif={setObjectif} ravitos={ravitos}
                            setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} />;
  } else {
    ecran = <EcranCotes cotes={proches} toutes={COTES} position={position} sourcePosition={sourcePosition} filtres={filtres}
                        setFiltres={setFiltres} onChoisir={(cote, rang) => setDetail({ cote, rang })}
                        allurePlat={ALLURE_PLAT_MIN_KM} onLocaliser={localiser}
                        onLieu={(l) => choisirLieu({ lat: l.lat, lon: l.lon }, l.label)}
                        source={(cotesExportees as { source: string }).source.includes("sqlite") ? "base précalculée" : "zone de Rennes"} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.fond, paddingTop: bords.top }}>
      <StatusBar style="dark" />
      {ecran}
      <Navigation actif={detail ? "cotes" : onglet} basSur={bords.bottom}
                  onChange={(o) => { setDetail(null); setOnglet(o); }} />
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
