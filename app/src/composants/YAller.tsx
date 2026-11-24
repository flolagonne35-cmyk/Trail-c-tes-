// Bouton « Y aller » : ouvre l'itinéraire dans l'application de navigation choisie (Google Maps, Waze,
// Plans), avec le mode (voiture, à pied, vélo). Le choix est retenu ; « changer » le rouvre.

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Position } from "../calcul/geo.ts";
import {
  applisDisponibles, chargerPrefNav, enregistrerPrefNav, NOMS_APPLIS, NOMS_MODES_NAV, ouvrirItineraire,
  type AppliNav, type ModeNav, type PrefNav,
} from "../navigation.ts";
import { C, S } from "../theme.ts";
import { Segments } from "./communs.tsx";

export function YAller({ destination, libelle = "Y aller" }: { destination: Position; libelle?: string }) {
  const [pref, setPref] = useState<PrefNav | null>(null);
  const [choix, setChoix] = useState(false);
  const [brouillon, setBrouillon] = useState<PrefNav>({ appli: "google", mode: "voiture" });
  useEffect(() => { chargerPrefNav().then(setPref); }, []);
  const valider = () => {
    enregistrerPrefNav(brouillon);
    setPref(brouillon);
    setChoix(false);
    ouvrirItineraire(destination, brouillon);
  };
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => (pref ? ouvrirItineraire(destination, pref) : (setBrouillon({ appli: "google", mode: "voiture" }), setChoix(true)))}
                 accessibilityRole="link" style={S.bouton}>
        <Text style={S.boutonTexte}>{libelle}{pref ? ` · ${NOMS_APPLIS[pref.appli]}, ${NOMS_MODES_NAV[pref.mode].toLowerCase()}` : ""}</Text>
      </Pressable>
      {pref && !choix && (
        <Pressable onPress={() => { setBrouillon(pref); setChoix(true); }} accessibilityRole="button" hitSlop={6}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: C.gris, textAlign: "center" }}>Changer d'application ou de mode</Text>
        </Pressable>
      )}
      {choix && (
        <View style={{ backgroundColor: C.blanc, borderRadius: 16, padding: 14, gap: 10 }}>
          <Text style={S.fort}>Avec quelle application ?</Text>
          <Segments options={applisDisponibles().map((a) => [a, NOMS_APPLIS[a]] as [AppliNav, string])} valeur={brouillon.appli}
                    onChange={(appli) => setBrouillon({ appli, mode: appli === "waze" ? "voiture" : brouillon.mode })} />
          {brouillon.appli !== "waze" ? (
            <Segments options={(["voiture", "pied", "velo"] as ModeNav[]).map((m) => [m, NOMS_MODES_NAV[m]] as [ModeNav, string])}
                      valeur={brouillon.mode} onChange={(mode) => setBrouillon({ ...brouillon, mode })} />
          ) : <Text style={S.petit}>Waze ne guide qu'en voiture.</Text>}
          <Pressable onPress={valider} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Ouvrir l'itinéraire</Text>
          </Pressable>
          <Text style={S.petit}>Ton choix est retenu pour les prochaines fois.</Text>
        </View>
      )}
    </View>
  );
}
