// « Retour au départ » : une grosse flèche vers le point de départ (ta voiture, ta porte) et la
// distance, avec le GPS et la boussole du téléphone, sans réseau. Utile quand on se perd en trail.
// Sans boussole (certains navigateurs), on donne la direction en mots : « au nord-ouest ».

import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { angleFleche, cap, consigne, pointCardinal } from "../calcul/cap.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { distanceM, type Position } from "../calcul/geo.ts";
import { C, S } from "../theme.ts";

type EvenementOrientation = DeviceOrientationEvent & { webkitCompassHeading?: number };

/** Orientation du téléphone (degrés depuis le nord) ; null tant qu'elle est inconnue. */
function useOrientation(actif: boolean): number | null {
  const [o, setO] = useState<number | null>(null);
  useEffect(() => {
    if (!actif) return;
    if (Platform.OS !== "web") {
      let abonnement: { remove: () => void } | null = null;
      Location.watchHeadingAsync((h) => setO(h.trueHeading >= 0 ? h.trueHeading : h.magHeading))
        .then((a) => { abonnement = a; }).catch(() => undefined);
      return () => abonnement?.remove();
    }
    if (typeof window === "undefined") return;
    // iPhone : webkitCompassHeading ; Android : « deviceorientationabsolute » (alpha compté vers l'ouest)
    const lire = (e: Event) => {
      const ev = e as EvenementOrientation;
      if (typeof ev.webkitCompassHeading === "number") setO(ev.webkitCompassHeading);
      else if (ev.absolute && typeof ev.alpha === "number") setO((360 - ev.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", lire);
    window.addEventListener("deviceorientation", lire);
    return () => {
      window.removeEventListener("deviceorientationabsolute", lire);
      window.removeEventListener("deviceorientation", lire);
    };
  }, [actif]);
  return o;
}

export function RetourDepart({ depart, nomDepart }: { depart: Position; nomDepart: string }) {
  const [cible, setCible] = useState<{ position: Position; nom: string }>({ position: depart, nom: nomDepart });
  const [actif, setActif] = useState(false);
  const [ici, setIci] = useState<Position | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const suivi = useRef<{ remove: () => void } | null>(null);
  const orientation = useOrientation(actif);

  useEffect(() => { setCible({ position: depart, nom: nomDepart }); }, [depart.lat, depart.lon, nomDepart]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => suivi.current?.remove(), []);

  const demarrer = async () => {
    setErreur(null);
    // iPhone (Safari) : la boussole demande une autorisation, au moment d'un appui
    const D = (typeof window !== "undefined" ? (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent : undefined);
    if (Platform.OS === "web" && D?.requestPermission) await D.requestPermission().catch(() => undefined);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setErreur("Position refusée : autorise-la dans les réglages du téléphone."); return; }
      suivi.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (p) => setIci({ lat: p.coords.latitude, lon: p.coords.longitude }));
      setActif(true);
    } catch {
      setErreur("Position indisponible : vérifie que le GPS est activé.");
    }
  };
  const arreter = () => { suivi.current?.remove(); suivi.current = null; setActif(false); };
  const memoriserIci = async () => {
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCible({ position: { lat: p.coords.latitude, lon: p.coords.longitude }, nom: "le point mémorisé" });
    } catch {
      setErreur("Position indisponible : vérifie que le GPS est activé.");
    }
  };

  const d = ici ? distanceM(ici, cible.position) : null;
  const c = ici ? cap(ici, cible.position) : null;
  // avec la boussole : flèche relative au téléphone ; sans : flèche relative au nord (haut de l'écran)
  const angle = c === null ? 0 : orientation === null ? c : angleFleche(c, orientation);

  return (
    <View style={[S.carte, { gap: 12 }]}>
      <Text style={[S.surtitre, { fontSize: 12 }]} accessibilityRole="header">Sécurité</Text>
      <Text style={S.fort}>Retour au départ</Text>
      <Text style={S.petit}>
        Une flèche vers {cible.nom === nomDepart ? `ton départ (${nomDepart})` : cible.nom} et la distance, même sans réseau.
        Le GPS consomme de la batterie : lance-la quand tu en as besoin.
      </Text>
      {!actif ? (
        <View style={{ gap: 10 }}>
          <Pressable onPress={demarrer} accessibilityRole="button" style={[S.bouton, { minHeight: 56 }]}>
            <Text style={[S.boutonTexte, { fontSize: 17 }]}>Guide-moi vers le départ</Text>
          </Pressable>
          <Pressable onPress={memoriserIci} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Mémoriser ma position actuelle comme départ</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 8 }}>
          {d === null ? (
            <Text style={S.fort}>Recherche du GPS…</Text>
          ) : d < 30 ? (
            <Text style={[S.h2, { fontSize: 24, color: C.descenteFonce }]}>Tu es arrivé !</Text>
          ) : (
            <>
              <View style={{ transform: [{ rotate: `${angle}deg` }] }} accessibilityLabel={`Direction du départ : ${orientation === null ? `au ${pointCardinal(c!)}` : consigne(angle)}`}>
                <Svg width={150} height={150} viewBox="0 0 100 100">
                  <Path d="M50 6 L80 80 L50 64 L20 80 Z" fill={C.montee} stroke={C.monteeFonce} strokeWidth={3} strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={{ fontSize: 40, fontWeight: "900", color: C.encre }}>{kmLisibles(d)}</Text>
              <Text style={[S.fort, { fontSize: 18 }]}>
                {orientation === null ? `Le départ est au ${pointCardinal(c!)}` : consigne(angle)}
              </Text>
              <Text style={S.petit}>
                {orientation === null ? "Pas de boussole : la flèche pointe vers le départ, le haut de l'écran étant le nord."
                  : "Tiens le téléphone à plat devant toi. À vol d'oiseau : suis les chemins, pas la flèche à travers champs."}
              </Text>
            </>
          )}
          <Pressable onPress={arreter} accessibilityRole="button" style={[S.boutonClair, { alignSelf: "stretch" }]}>
            <Text style={S.boutonClairTexte}>Arrêter</Text>
          </Pressable>
        </View>
      )}
      {erreur && <Text style={{ color: C.monteeFonce, fontWeight: "600" }} accessibilityRole="alert">{erreur}</Text>}
    </View>
  );
}
