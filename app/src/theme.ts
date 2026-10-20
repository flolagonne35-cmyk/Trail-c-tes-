// Couleurs et styles repris de la maquette (4 écrans, 390 × 844).

import { StyleSheet } from "react-native";

export const C = {
  fond: "#F4F1EA",
  encre: "#1B2A22",
  gris: "#5A6259",
  sable: "#E8E2D4",
  blanc: "#FFFFFF",
  aire: "#EFEADF",
  montee: "#D9541E",
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

export const S = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: C.fond },
  contenu: { paddingHorizontal: 20, paddingBottom: 24 },
  surtitre: { fontSize: 13, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", color: C.gris },
  titre: { fontSize: 28, lineHeight: 31, fontWeight: "700", color: C.encre, marginTop: 4 },
  sousTitre: { fontSize: 14, color: C.gris, marginTop: 6 },
  h2: { fontSize: 17, fontWeight: "700", color: C.encre },
  carte: { backgroundColor: C.blanc, borderRadius: 16, padding: 12, marginTop: 14 },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.blanc, borderRadius: 14,
           paddingVertical: 10, paddingHorizontal: 12 },
  petit: { fontSize: 12, color: C.gris },
  fort: { fontSize: 15, fontWeight: "700", color: C.encre },
  bouton: { minHeight: 48, borderRadius: 14, backgroundColor: C.encre, alignItems: "center", justifyContent: "center",
            paddingHorizontal: 16 },
  boutonTexte: { color: C.fond, fontSize: 15, fontWeight: "700" },
  boutonClair: { minHeight: 48, borderRadius: 14, backgroundColor: C.sable, alignItems: "center",
                 justifyContent: "center", paddingHorizontal: 16 },
  boutonClairTexte: { color: C.encre, fontSize: 15, fontWeight: "700" },
});
