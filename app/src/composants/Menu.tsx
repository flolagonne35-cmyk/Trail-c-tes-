// Menu latéral : toutes les sections de l'appli, rangées par catégorie, pour ne jamais se perdre.

import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { C, S } from "../theme.ts";
import { Icone, type Page } from "./communs.tsx";

export type Destination = { page: Page; mode?: string };
type Entree = Destination & { icone: Parameters<typeof Icone>[0]["nom"]; titre: string; detail: string };

export const CATEGORIES: { titre: string; entrees: Entree[] }[] = [
  { titre: "Explorer", entrees: [
    { page: "cotes", mode: "montee", icone: "cotes", titre: "Côtes", detail: "Autour de toi ou d'une ville, carte et liste" },
    { page: "cotes", mode: "descente", icone: "cotes", titre: "Descentes", detail: "Pour préparer les quadriceps" },
  ] },
  { titre: "S'entraîner", entrees: [
    { page: "entrainement", mode: "seance", icone: "seance", titre: "Séance du coach", detail: "« 8 × 400 m à 10 % » : où la faire" },
    { page: "entrainement", mode: "boucle", icone: "boucle", titre: "Sortie sur mesure", detail: "« 2 h sur du plat », « 10 km avec 3 côtes » : boucle et GPX" },
    { page: "entrainement", mode: "progres", icone: "chrono", titre: "Mes progrès", detail: "Chronos sur mes côtes, allure selon la pente" },
  ] },
  { titre: "Courses", entrees: [
    { page: "agenda", icone: "position", titre: "Courses à venir", detail: "Près de chez toi : dates, formats, site officiel" },
    { page: "courses", icone: "calendrier", titre: "Mes courses", detail: "Calendrier de l'année, budget, compte à rebours" },
    { page: "course", icone: "course", titre: "Préparer une course", detail: "Profil, temps de passage, prépa près de chez toi" },
    { page: "nutrition", icone: "nutrition", titre: "Nutrition", detail: "Glucides, eau, sel : par heure et par ravito" },
  ] },
  { titre: "Moi", entrees: [
    { page: "profil", icone: "profil", titre: "Profil et sorties", detail: "Avatar, points, sorties GPX, classement" },
  ] },
  { titre: "Infos", entrees: [
    { page: "sources", icone: "info", titre: "Données et confidentialité", detail: "D'où viennent les chiffres, ce qui reste sur ton téléphone" },
  ] },
];

export function Menu({ actuelle, onAller, onFermer, entete }: {
  actuelle: Destination; onAller: (d: Destination) => void; onFermer: () => void; entete: ReactNode;
}) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
      <View style={{ width: "84%", maxWidth: 340, backgroundColor: C.fond, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <View style={{ flex: 1 }}>{entete}</View>
            <Pressable onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer le menu"
                       style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Icone nom="fermer" />
            </Pressable>
          </View>
          {CATEGORIES.map((cat) => (
            <View key={cat.titre} style={{ marginTop: 14 }}>
              <Text style={[S.surtitre, { fontSize: 12, marginBottom: 6 }]}>{cat.titre}</Text>
              <View style={{ backgroundColor: C.blanc, borderRadius: 16, overflow: "hidden" }}>
                {cat.entrees.map((e, i) => {
                  const actif = e.page === actuelle.page && (!e.mode || e.mode === actuelle.mode);
                  return (
                    <Pressable key={e.titre} onPress={() => onAller(e)} accessibilityRole="button" aria-selected={actif}
                               accessibilityLabel={`${e.titre}. ${e.detail}`}
                               style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12,
                                                          paddingVertical: 10, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: C.aire,
                                                          backgroundColor: actif ? C.monteeClair : pressed ? C.aire : C.blanc })}>
                      <Icone nom={e.icone} couleur={actif ? C.monteeFonce : C.gris} taille={20} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: actif ? C.monteeFonce : C.encre }}>{e.titre}</Text>
                        <Text style={S.petit} numberOfLines={2}>{e.detail}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <Pressable style={{ flex: 1, backgroundColor: "#1B2A2266" }} onPress={onFermer} accessibilityLabel="Fermer le menu" />
    </View>
  );
}
