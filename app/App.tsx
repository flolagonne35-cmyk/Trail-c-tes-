// Trail-côtes : parcours segmenté, plan nutrition, côtes à proximité (maquette des 4 écrans).

import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
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
import { EcranNutrition } from "./src/ecrans/Nutrition.tsx";
import { EcranParcours } from "./src/ecrans/Parcours.tsx";
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

  useEffect(() => {
    if (onglet !== "cotes" || sourcePosition.startsWith("position actuelle")) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setSourcePosition("localisation refusée : Rennes par défaut");
          return;
        }
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setSourcePosition(`position actuelle (± ${Math.round(p.coords.accuracy ?? 0)} m)`);
      } catch {
        setSourcePosition("position indisponible : Rennes par défaut");
      }
    })();
  }, [onglet, sourcePosition]);

  const proches = useMemo(() => cotesProches(COTES, position, filtres), [position, filtres]);

  useEffect(() => setRavitos([]), [parcours]);

  let ecran;
  if (detail) {
    ecran = <EcranDetail cote={detail.cote} rang={detail.rang} allurePlat={ALLURE_PLAT_MIN_KM} retour={() => setDetail(null)} />;
  } else if (onglet === "parcours") {
    ecran = <EcranParcours parcours={parcours} onParcours={setParcours} />;
  } else if (onglet === "nutrition") {
    ecran = <EcranNutrition parcours={parcours} objectif={objectif} setObjectif={setObjectif} ravitos={ravitos}
                            setRavitos={setRavitos} prefs={prefs} setPrefs={setPrefs} />;
  } else {
    ecran = <EcranCotes cotes={proches} position={position} sourcePosition={sourcePosition} filtres={filtres}
                        setFiltres={setFiltres} onChoisir={(cote, rang) => setDetail({ cote, rang })}
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
