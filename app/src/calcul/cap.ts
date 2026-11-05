// Retour au départ : direction (cap) et distance vers le point de départ, calculées sur le
// téléphone avec le GPS, sans réseau. Cap initial du grand cercle (formule classique de navigation).

import type { Position } from "./geo.ts";

const rad = (d: number) => (d * Math.PI) / 180;

/** Cap de a vers b, en degrés depuis le nord, dans le sens des aiguilles d'une montre (0 à 360). */
export function cap(a: Position, b: Position): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const POINTS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
/** « nord-ouest » pour 315°. */
export const pointCardinal = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Angle de la flèche à l'écran : le cap moins l'orientation du téléphone (0 = droit devant). */
export const angleFleche = (capDeg: number, orientationDeg: number) => (((capDeg - orientationDeg) % 360) + 360) % 360;

/** « Droit devant », « légèrement à gauche », « derrière toi »… pour le dire avec des mots. */
export function consigne(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < 20 || a > 340) return "Droit devant";
  if (a <= 60) return "Légèrement à droite";
  if (a <= 135) return "À droite";
  if (a < 225) return "Derrière toi : fais demi-tour";
  if (a < 300) return "À gauche";
  return "Légèrement à gauche";
}
