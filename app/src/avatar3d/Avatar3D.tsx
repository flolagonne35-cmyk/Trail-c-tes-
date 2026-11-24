// L'avatar en 3D : le corps réglé du coureur, qu'on fait tourner du doigt (ou de la souris).
// Rendu three.js dans une vue expo-gl, la même sur le web, l'iPhone et Android.

import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Platform, Text, View } from "react-native";
import * as THREE from "three";

import { C } from "../theme.ts";
import { chargerCorps } from "./charger.ts";
import type { Corps, DonneesCorps } from "./corps.ts";
import { creerScene, type Rendu } from "./scene.ts";

export function Avatar3D({ corps, hauteur = 420, tourne = true }: { corps: Corps; hauteur?: number; tourne?: boolean }) {
  const [donnees, setDonnees] = useState<DonneesCorps | null | undefined>(undefined);
  useEffect(() => { chargerCorps().then(setDonnees); }, []);
  const rendu = useRef<Rendu | null>(null);
  const angle = useRef(0.25);
  const touche = useRef(false);
  const corpsRef = useRef(corps);
  corpsRef.current = corps;
  useEffect(() => { rendu.current?.regler(corps); }, [corps]);

  const glisser = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
    onPanResponderGrant: () => { touche.current = true; },
    onPanResponderMove: (_, g) => { angle.current += g.vx * 0.12; },
    onPanResponderRelease: () => { setTimeout(() => { touche.current = false; }, 2500); },
  }), []);

  const creer = (gl: ExpoWebGLRenderingContext) => {
    if (!donnees) return;
    const largeur = gl.drawingBufferWidth;
    const haut = gl.drawingBufferHeight;
    // sur le téléphone, three.js attend un « canvas » : on lui en donne un minimal
    const canvas = Platform.OS === "web" ? (gl.canvas as HTMLCanvasElement)
      : ({ width: largeur, height: haut, style: {}, addEventListener: () => {}, removeEventListener: () => {}, clientHeight: haut } as unknown as HTMLCanvasElement);
    const moteur = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGLRenderingContext, antialias: true, alpha: true });
    moteur.setPixelRatio(1);
    moteur.setSize(largeur, haut, false);
    moteur.setClearColor(0x000000, 0);
    moteur.toneMapping = THREE.ACESFilmicToneMapping;
    moteur.toneMappingExposure = 1.25;
    moteur.outputColorSpace = THREE.SRGBColorSpace;
    const r = creerScene(donnees, corpsRef.current, largeur / haut);
    rendu.current = r;
    let actif = true;
    const boucle = () => {
      if (!actif) return;
      if (tourne && !touche.current) angle.current += 0.0035;
      r.pivot.rotation.y = angle.current;
      moteur.render(r.scene, r.camera);
      (gl as unknown as { endFrameEXP?: () => void }).endFrameEXP?.();
      requestAnimationFrame(boucle);
    };
    boucle();
    return () => { actif = false; };
  };

  return (
    <View style={{ height: hauteur, width: "100%" }} {...glisser.panHandlers}
          accessibilityLabel="Ton coureur en 3D : fais-le tourner en glissant le doigt">
      {donnees === undefined && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.montee} /></View>
      )}
      {donnees === null && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Text style={{ color: C.gris, textAlign: "center" }}>Le coureur 3D se charge avec une connexion internet.</Text>
        </View>
      )}
      {donnees && <GLView style={{ flex: 1 }} onContextCreate={creer} />}
    </View>
  );
}
