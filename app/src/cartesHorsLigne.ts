// Carte hors ligne (iOS, Android) : les tuiles Plan IGN d'une zone sont téléchargées une fois dans
// le dossier de l'application, puis la carte les lit sans réseau. Sur le web, rien n'est stocké.

import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import type { Position } from "./calcul/geo.ts";
import { SOURCE_IGN, tuilesZone } from "./calcul/tuiles.ts";

export const HORS_LIGNE_POSSIBLE = Platform.OS !== "web";
const ZOOM_MIN = 11;
const ZOOM_MAX = 16;
const SIMULTANES = 2; // service public partagé : peu de requêtes à la fois

const fichier = (z: number, x: number, y: number) => new File(Paths.document, "tuiles", String(z), String(x), `${y}.png`);

// la carte se redessine à chaque glissement : on mémorise la réponse plutôt que d'interroger le disque
const connues = new Map<string, string | null>();

/** Adresse locale de la tuile si elle a été téléchargée, sinon null. */
export function tuileLocale(z: number, x: number, y: number): string | null {
  if (!HORS_LIGNE_POSSIBLE) return null;
  const cle = `${z}/${x}/${y}`;
  if (!connues.has(cle)) {
    try {
      const f = fichier(z, x, y);
      connues.set(cle, f.exists ? f.uri : null);
    } catch {
      connues.set(cle, null);
    }
  }
  return connues.get(cle)!;
}

export const nombreTuiles = (centre: Position, rayonM: number) => tuilesZone(centre, rayonM, ZOOM_MIN, ZOOM_MAX).length;

/** Télécharge les tuiles manquantes de la zone ; `onProgres(faites, total)`. Renvoie le nombre d'échecs. */
export async function telechargerZone(centre: Position, rayonM: number, onProgres: (faites: number, total: number) => void,
                                      annule: () => boolean = () => false): Promise<number> {
  const tuiles = tuilesZone(centre, rayonM, ZOOM_MIN, ZOOM_MAX);
  let faites = 0;
  let echecs = 0;
  let suivante = 0;
  const travailleur = async () => {
    while (suivante < tuiles.length && !annule()) {
      const [z, x, y] = tuiles[suivante++];
      const f = fichier(z, x, y);
      if (!f.exists) {
        try {
          const dossier = new Directory(Paths.document, "tuiles", String(z), String(x));
          if (!dossier.exists) dossier.create({ intermediates: true });
          await File.downloadFileAsync(SOURCE_IGN.url(z, x, y), f);
          connues.set(`${z}/${x}/${y}`, f.uri);
        } catch {
          echecs++;
        }
      }
      onProgres(++faites, tuiles.length);
    }
  };
  await Promise.all(Array.from({ length: SIMULTANES }, travailleur));
  return echecs;
}

/** Supprime toutes les tuiles téléchargées. */
export function viderCarteHorsLigne() {
  const d = new Directory(Paths.document, "tuiles");
  if (d.exists) d.delete();
  connues.clear();
}
