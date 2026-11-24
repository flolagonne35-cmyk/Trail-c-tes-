// L'avatar en 3D : le corps réglé du coureur, qu'on fait tourner du doigt (ou de la souris).
// Rendu three.js dans une vue expo-gl, la même sur le web, l'iPhone et Android.

import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, PanResponder, Platform, Text, View } from "react-native";
import * as THREE from "three";

import { C } from "../theme.ts";
import { chargerCorps } from "./charger.ts";
import type { Corps, DonneesCorps } from "./corps.ts";
import type { Pose } from "./pose.ts";
import { creerScene, type Rendu } from "./scene.ts";

// Foulée affichée : environ 0,8 cycle par seconde, la moitié d'une vraie cadence de course
// (170 à 180 pas par minute, soit environ 1,45 cycle par seconde), pour que le geste se lise.
const CYCLES_PAR_SECONDE = 0.8;

export function Avatar3D({ corps, hauteur = 420, tourne = false, pose = "course" }: { corps: Corps; hauteur?: number; tourne?: boolean; pose?: Pose }) {
  const [donnees, setDonnees] = useState<DonneesCorps | null | undefined>(undefined);
  useEffect(() => { chargerCorps().then(setDonnees); }, []);
  const rendu = useRef<Rendu | null>(null);
  const angle = useRef(0.25);
  const touche = useRef(false);
  const corpsRef = useRef(corps);
  corpsRef.current = corps;
  useEffect(() => { rendu.current?.regler(corps); }, [corps]);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  useEffect(() => { rendu.current?.poser(pose); }, [pose]);
  // « réduire les animations » (réglage d'accessibilité du téléphone) : le coureur reste figé en pleine foulée
  const calme = useRef(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then((v) => { calme.current = v; }).catch(() => {}); }, []);

  // retour du 24/11 : il ne tourne plus tout seul ; on le fait tourner en glissant (doigt ou souris),
  // d'un tour complet pour environ 400 pixels
  const depart = useRef(0);
  const glisser = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { touche.current = true; depart.current = angle.current; },
    onPanResponderMove: (_, g) => { angle.current = depart.current + g.dx * 0.016; },
    onPanResponderRelease: () => { touche.current = false; },
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
    r.poser(poseRef.current);
    let actif = true;
    let image = 0;
    const debut = Date.now();
    const boucle = () => {
      if (!actif) return;
      if (tourne && !touche.current) angle.current += 0.0035;
      // la foulée est recalculée une image sur deux (30 images par seconde suffisent à l'œil)
      if (poseRef.current === "course" && !calme.current && image++ % 2 === 0) {
        r.poser("course", Math.PI / 2 + ((Date.now() - debut) / 1000) * CYCLES_PAR_SECONDE * 2 * Math.PI);
      }
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
          accessibilityLabel="Ton coureur en 3D : fais-le tourner en glissant le doigt ou la souris">
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
