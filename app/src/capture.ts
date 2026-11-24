// Choisir une capture d'écran dans la galerie (ou les fichiers), la réduire, et la faire lire par
// /api/capture. L'image n'est envoyée que sur demande du coureur, et n'est pas gardée.

import * as DocumentPicker from "expo-document-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import type { LectureActivite, LectureProfil, TypeCapture } from "./calcul/capture.ts";

const URL_CAPTURE = Platform.OS === "web" ? "/api/capture" : "https://trail-cotes.pages.dev/api/capture";
const COTE_MAX = 1280;

/** Image réduite (1 280 px au plus, JPEG) en « data URL », ou null si l'utilisateur annule. */
export async function choisirImage(): Promise<{ apercu: string; donnees: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const uri = r.assets[0].uri;
  if (Platform.OS === "web") {
    const img = new Image();
    img.src = uri;
    await img.decode();
    const k = Math.min(1, COTE_MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const donnees = c.toDataURL("image/jpeg", 0.82);
    return { apercu: donnees, donnees };
  }
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: COTE_MAX });
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  return { apercu: img.uri, donnees: `data:image/jpeg;base64,${img.base64}` };
}

export async function lireCapture(type: "activite", image: string): Promise<LectureActivite>;
export async function lireCapture(type: "profil", image: string): Promise<LectureProfil>;
export async function lireCapture(type: TypeCapture, image: string): Promise<LectureActivite | LectureProfil> {
  const r = await fetch(URL_CAPTURE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, image }) });
  const j = (await r.json().catch(() => ({}))) as { lecture?: LectureActivite | LectureProfil; erreur?: string };
  if (!r.ok || !j.lecture) throw new Error(j.erreur ?? "Lecture impossible.");
  return j.lecture;
}
