// Charte Trail-côtes (v2, 23/11) : un fond clair et chaud, une encre vert forêt profond, et une
// seule couleur signature, l'orange « lever de soleil » des côtes. Beaucoup d'air : marges de
// 24 px, 28 px entre deux blocs, cartes sans bordure ni bande de couleur, ombre très douce.

import { Platform, StyleSheet } from "react-native";

export const C = {
  fond: "#F6F4EF",
  encre: "#14231B",
  foret: "#1F3D2E", // fonds sombres (bandeau d'accueil, barre latérale)
  gris: "#5F6A63",
  sable: "#ECE8DF",
  blanc: "#FFFFFF",
  aire: "#EFECE5",
  montee: "#D9541E",
  monteeDouce: "#E39A2D",
  monteeFonce: "#8A2F08",
  monteeClair: "#FBE3D6",
  descente: "#2F6F9F",
  descenteFonce: "#1D4A6E",
  descenteClair: "#DCEAF4",
  plat: "#7A7F78",
  platFonce: "#3F463F",
  platClair: "#E6E6DF",
  carte: "#E3EAD9",
  carteRiviere: "#C9D6BD",
};

export const COULEUR_TYPE = {
  "montée": { trait: C.montee, fond: C.monteeClair, texte: C.monteeFonce },
  descente: { trait: C.descente, fond: C.descenteClair, texte: C.descenteFonce },
  plat: { trait: C.plat, fond: C.platClair, texte: C.platFonce },
} as const;

/** Espacements : on n'utilise que ces valeurs, pour un rythme régulier. */
export const ESPACE = { xs: 6, s: 10, m: 16, l: 24, xl: 32 };

/** Ombre très douce des cartes (les cartes n'ont ni bordure ni bande de couleur). */
export const OMBRE = Platform.select({
  web: { boxShadow: "0 1px 2px rgba(20,35,27,0.04), 0 6px 20px rgba(20,35,27,0.06)" } as object,
  default: { shadowColor: "#14231B", shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});

export const S = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: C.fond },
  contenu: { paddingHorizontal: ESPACE.l, paddingBottom: 40 },
  surtitre: { fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: C.gris },
  titre: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: C.encre, marginTop: 4, letterSpacing: -0.4 },
  sousTitre: { fontSize: 16, lineHeight: 23, color: C.gris, marginTop: 8 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: C.encre, letterSpacing: -0.2 },
  carte: { backgroundColor: C.blanc, borderRadius: 22, padding: 20, marginTop: ESPACE.l, ...OMBRE },
  ligne: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.blanc, borderRadius: 18,
           paddingVertical: 16, paddingHorizontal: 18, ...OMBRE },
  petit: { fontSize: 14, lineHeight: 20, color: C.gris },
  texte: { fontSize: 16, lineHeight: 24, color: C.encre },
  fort: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: C.encre },
  bouton: { minHeight: 54, borderRadius: 16, backgroundColor: C.encre, alignItems: "center", justifyContent: "center",
            paddingHorizontal: 20 },
  boutonTexte: { color: C.fond, fontSize: 16, fontWeight: "700" },
  boutonClair: { minHeight: 52, borderRadius: 16, backgroundColor: C.sable, alignItems: "center",
                 justifyContent: "center", paddingHorizontal: 20 },
  boutonClairTexte: { color: C.encre, fontSize: 16, fontWeight: "700" },
});

/**
 * Identité de chaque rubrique (retour du 23/11 : « chaque page un truc vraiment spécifique ») :
 * une couleur d'accent, un fond d'en-tête, une phrase et un motif dessiné, repris par les onglets.
 * - Aujourd'hui : l'orange du lever de soleil (la journée qui commence) ;
 * - Explorer : le vert des cartes topographiques (courbes de niveau) ;
 * - Ma course : le bleu du dossard et de la ligne d'arrivée ;
 * - Mon monde : l'or des médailles.
 */
export type Rubrique = "accueil" | "cotes" | "courses" | "monde" | "autre";
export const RUBRIQUES: Record<Rubrique, { accent: string; fond: string; clair: string; phrase: string }> = {
  accueil: { accent: C.montee, fond: "#FBEBDD", clair: C.monteeClair, phrase: "Ta séance, ta semaine, ta prochaine course" },
  cotes: { accent: "#2E7A4F", fond: "#E4ECDC", clair: "#D6E6CF", phrase: "Côtes, parcours et lieux de séance autour de toi" },
  courses: { accent: "#2F6F9F", fond: "#E2ECF5", clair: C.descenteClair, phrase: "Choisir, préparer et courir ta course" },
  monde: { accent: "#A8741A", fond: "#F5ECD6", clair: "#F1E0B8", phrase: "Ta progression, ton coureur, tes chronos" },
  autre: { accent: C.encre, fond: C.fond, clair: C.sable, phrase: "" },
};
