// Import d'un GPX et partage d'un fichier, sur mobile comme sur le web.

import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

/** Ouvre le sélecteur ; renvoie { nom, texte } ou null si l'utilisateur annule. */
export async function choisirGpx(): Promise<{ nom: string; texte: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const texte = Platform.OS === "web" ? await (await fetch(a.uri)).text() : await new File(a.uri).text();
  return { nom: a.name.replace(/\.gpx$/i, ""), texte };
}

/** Partage un fichier texte (GPX…) : feuille de partage sur mobile, téléchargement sur le web. */
export async function partagerFichier(nomFichier: string, contenu: string, type = "application/gpx+xml") {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
    return;
  }
  const f = new File(Paths.cache, nomFichier);
  f.create({ overwrite: true });
  f.write(contenu);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: type });
}

export async function partagerTexte(titre: string, texte: string) {
  if (Platform.OS === "web") {
    await partagerFichier(`${titre}.txt`, texte, "text/plain");
    return;
  }
  await Share.share({ title: titre, message: texte });
}
