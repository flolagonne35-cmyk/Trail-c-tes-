// Vraie carte en tuiles (Plan IGN) : glisser pour se déplacer, + / − pour zoomer, côtes tracées
// et numérotées, position de l'utilisateur. Fonctionne sur iOS, Android et le web (Expo Go compris),
// sans module natif.

import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";

import type { Position } from "../calcul/geo.ts";
import {
  metresParPixel, SOURCE_IGN, SOURCE_LOCALE, surEcran, tuilesVisibles, versPixel, versPosition,
} from "../calcul/tuiles.ts";
import { C } from "../theme.ts";

// version de test sans réseau : tuiles publiées avec la page
const SOURCE = process.env.EXPO_PUBLIC_TUILES_LOCALES === "1" ? SOURCE_LOCALE : SOURCE_IGN;
const Z_MAX = 18;

export type Trace = { id: number; points: Position[]; couleur: string; epaisseur?: number };
export type Marqueur = { id: string; position: Position; texte: string; couleur: string; label: string; onPress?: () => void };

export function Carte({ hauteur = 300, centre: centreInitial, zoom: zoomInitial, traces = [], marqueurs = [],
                        position, rayonM, cle }: {
  hauteur?: number; centre: Position; zoom: number; traces?: Trace[]; marqueurs?: Marqueur[];
  position?: Position; rayonM?: number; cle: string; // une nouvelle clé recentre la carte
}) {
  // au-delà de zMax + 1, les tuiles agrandies deviennent floues (version de test sans réseau)
  zoomInitial = Math.min(zoomInitial, SOURCE.zMax + 1);
  const [largeur, setLargeur] = useState(0);
  const [centre, setCentre] = useState(centreInitial);
  const [zoom, setZoom] = useState(zoomInitial);
  const [glisse, setGlisse] = useState({ dx: 0, dy: 0 });
  const etat = useRef({ centre, zoom });
  etat.current = { centre, zoom };

  useEffect(() => {
    setCentre(centreInitial);
    setZoom(zoomInitial);
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  const glissement = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => setGlisse({ dx: g.dx, dy: g.dy }),
    onPanResponderRelease: (_, g) => {
      const { centre: c, zoom: z } = etat.current;
      const [cx, cy] = versPixel(c, z);
      setCentre(versPosition(cx - g.dx, cy - g.dy, z));
      setGlisse({ dx: 0, dy: 0 });
    },
    onPanResponderTerminate: () => setGlisse({ dx: 0, dy: 0 }),
  }), []);

  const zoomer = (pas: number) => setZoom((z) => Math.min(Z_MAX, Math.max(SOURCE.zMin, z + pas)));
  const ecran = (p: Position) => surEcran(p, centre, zoom, largeur, hauteur);
  const tuiles = largeur ? tuilesVisibles(centre, zoom, largeur, hauteur, SOURCE) : [];
  const decalage = { transform: [{ translateX: glisse.dx }, { translateY: glisse.dy }] };
  const bouton = (texte: string, label: string, action: () => void) => (
    <Pressable onPress={action} accessibilityRole="button" accessibilityLabel={label}
               style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.blanc, alignItems: "center",
                        justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3,
                        shadowOffset: { width: 0, height: 1 }, elevation: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: C.encre }}>{texte}</Text>
    </Pressable>
  );

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
          style={[{ height: hauteur, overflow: "hidden", backgroundColor: C.carte, borderRadius: 16 },
                  Platform.OS === "web" ? ({ touchAction: "none", cursor: "grab" } as object) : null]}
          accessibilityLabel={`Carte : ${traces.length} côte${traces.length > 1 ? "s" : ""}`}>
      <View style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, decalage]} {...glissement.panHandlers}>
        {tuiles.map((t) => (
          <Image key={t.cle} source={{ uri: t.url }} accessibilityIgnoresInvertColors
                 style={{ position: "absolute", left: t.gauche, top: t.haut, width: t.taille, height: t.taille }} />
        ))}
        {largeur > 0 && (
          <Svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
            {rayonM && position ? (
              <Circle cx={ecran(position)[0]} cy={ecran(position)[1]} r={rayonM / metresParPixel(position.lat, zoom)}
                      fill="rgba(47,111,159,0.06)" stroke={C.descente} strokeWidth={1.5} strokeDasharray="6 5" />
            ) : null}
            {traces.map((t) => (
              <Polyline key={`f${t.id}`} points={t.points.map((p) => ecran(p).join(",")).join(" ")} fill="none"
                        stroke={C.blanc} strokeWidth={(t.epaisseur ?? 5) + 3} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {traces.map((t) => (
              <Polyline key={t.id} points={t.points.map((p) => ecran(p).join(",")).join(" ")} fill="none"
                        stroke={t.couleur} strokeWidth={t.epaisseur ?? 5} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {position && (
              <>
                <Circle cx={ecran(position)[0]} cy={ecran(position)[1]} r={14} fill="rgba(47,111,159,0.2)" />
                <Circle cx={ecran(position)[0]} cy={ecran(position)[1]} r={7} fill={C.descente} stroke={C.blanc} strokeWidth={3} />
              </>
            )}
          </Svg>
        )}
        {largeur > 0 && marqueurs.map((m) => {
          const [x, y] = ecran(m.position);
          if (x < -20 || y < -20 || x > largeur + 20 || y > hauteur + 20) return null;
          return (
            <Pressable key={m.id} onPress={m.onPress} accessibilityRole={m.onPress ? "button" : "image"} accessibilityLabel={m.label}
                       hitSlop={8}
                       style={{ position: "absolute", left: x - 13, top: y - 13, width: 26, height: 26, borderRadius: 13,
                                backgroundColor: m.couleur, borderWidth: 2, borderColor: C.blanc, alignItems: "center",
                                justifyContent: "center" }}>
              <Text style={{ color: C.blanc, fontSize: 12, fontWeight: "700" }}>{m.texte}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ position: "absolute", right: 8, top: 8, gap: 6 }}>
        {bouton("+", "Zoomer", () => zoomer(1))}
        {bouton("−", "Dézoomer", () => zoomer(-1))}
        {bouton("◎", "Recentrer", () => { setCentre(centreInitial); setZoom(zoomInitial); })}
      </View>
      <Text style={{ position: "absolute", left: 6, bottom: 4, fontSize: 10, color: C.encre, backgroundColor: "rgba(255,255,255,0.75)",
                     paddingHorizontal: 4, borderRadius: 3 }}>Plan IGN © IGN</Text>
    </View>
  );
}

/** Couleur d'une côte selon sa pente moyenne. */
export function couleurPente(pente: number): string {
  return pente >= 10 ? C.monteeFonce : pente >= 7 ? C.montee : C.monteeDouce;
}
