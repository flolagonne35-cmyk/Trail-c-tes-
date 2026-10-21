// Curseur de plage : deux poignées (minimum et maximum) sur une échelle de valeurs choisies, pour
// régler un critère à la valeur près (« pente de 6,5 à 9 % »), plus des raccourcis en un geste.
//
// L'échelle n'est pas forcément régulière (longueur : de 50 en 50 m, puis de 100 en 100…) : on
// déplace un indice dans la liste `valeurs`. La première valeur veut dire « pas de minimum », la
// dernière (Infinity) « pas de maximum ». Une seule poignée avec `unique` (distance maximale).

import { useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type LayoutChangeEvent } from "react-native";

import { C, S } from "../theme.ts";

export type Raccourci = { nom: string; bas: number; haut: number }; // valeurs (pas indices)

/** Indice de la valeur la plus proche dans l'échelle. */
export function indiceDe(valeurs: number[], v: number | undefined, defaut: number): number {
  if (v === undefined || !Number.isFinite(v)) return defaut;
  let meilleur = 0;
  valeurs.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(valeurs[meilleur] - v)) meilleur = i; });
  return meilleur;
}

export function Plage({ etiquette, valeurs, bas, haut, unique, format, resume, raccourcis, aide, onChange }: {
  etiquette: string; valeurs: number[]; bas: number; haut: number; unique?: boolean;
  format: (v: number) => string; // une valeur de l'échelle : « 6,5 % »
  resume: string; // la plage choisie, en clair : « 6,5 à 9 % », « Toutes »
  raccourcis?: Raccourci[]; aide?: string;
  onChange: (bas: number, haut: number) => void; // indices
}) {
  const [largeur, setLargeur] = useState(0);
  const n = valeurs.length;
  // le PanResponder est créé une fois : il lit les dernières valeurs dans une référence
  const etat = useRef({ bas, haut, largeur, onChange, depart: 0, poignee: "haut" as "bas" | "haut" });
  etat.current = { ...etat.current, bas, haut, largeur, onChange };

  const indice = (x: number) => {
    const w = etat.current.largeur;
    return w ? Math.max(0, Math.min(n - 1, Math.round((x / w) * (n - 1)))) : 0;
  };
  const deplacer = (x: number) => {
    const e = etat.current;
    const i = indice(x);
    if (e.poignee === "bas") { if (i !== e.bas) e.onChange(Math.min(i, e.haut), e.haut); }
    else if (i !== e.haut) e.onChange(e.bas, Math.max(i, unique ? 0 : e.bas));
  };
  const geste = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false, // la page ne vole pas le geste en cours
    onPanResponderGrant: (ev) => {
      const e = etat.current;
      const x = ev.nativeEvent.locationX;
      const xb = (e.bas / (n - 1)) * e.largeur;
      const xh = (e.haut / (n - 1)) * e.largeur;
      // la poignée la plus proche du doigt ; superposées, on part dans le sens du geste plus tard
      e.poignee = unique ? "haut" : Math.abs(x - xb) < Math.abs(x - xh) || (xb === xh && x < xb) ? "bas" : "haut";
      e.depart = x;
      deplacer(x);
    },
    onPanResponderMove: (_, g) => deplacer(etat.current.depart + g.dx),
  })).current;

  const position = (i: number) => (largeur * i) / (n - 1);
  const poignee = (cote: "bas" | "haut") => {
    const i = cote === "bas" ? bas : haut;
    const pas = (d: number) => {
      const j = Math.max(0, Math.min(n - 1, i + d));
      if (cote === "bas") onChange(Math.min(j, haut), haut); else onChange(bas, Math.max(j, unique ? 0 : bas));
    };
    return (
      <View key={cote} pointerEvents="none" accessible accessibilityRole="adjustable"
            accessibilityLabel={`${etiquette}, ${unique ? "maximum" : cote === "bas" ? "minimum" : "maximum"}`}
            accessibilityValue={{ text: format(valeurs[i]) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(a) => pas(a.nativeEvent.actionName === "increment" ? 1 : -1)}
            style={{ position: "absolute", left: position(i) - 14, top: 8, width: 28, height: 28, borderRadius: 14,
                     backgroundColor: C.blanc, borderWidth: 3, borderColor: C.montee,
                     shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }} />
    );
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={[S.fort, { flex: 1 }]}>{etiquette}</Text>
        <Text style={{ fontSize: 16, fontWeight: "800", color: C.montee }}>{resume}</Text>
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} {...geste.panHandlers}
              style={{ height: 44, justifyContent: "center" }}>
          <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: C.sable }} />
          {largeur > 0 && (
            <>
              <View pointerEvents="none" style={{ position: "absolute", height: 6, borderRadius: 3, backgroundColor: C.montee,
                                                  left: unique ? 0 : position(bas), width: position(haut) - (unique ? 0 : position(bas)) }} />
              {!unique && poignee("bas")}
              {poignee("haut")}
            </>
          )}
        </View>
        <View pointerEvents="none" style={{ flexDirection: "row", justifyContent: "space-between", marginTop: -4 }}>
          <Text style={S.petit}>{format(valeurs[0])}</Text>
          <Text style={S.petit}>{format(valeurs[n - 1])}</Text>
        </View>
      </View>
      {!!raccourcis?.length && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {raccourcis.map((r) => {
            const b = unique ? 0 : indiceDe(valeurs, r.bas, 0);
            const h = indiceDe(valeurs, r.haut, n - 1);
            const actif = (unique || b === bas) && h === haut;
            return (
              <Pressable key={r.nom} onPress={() => onChange(b, h)} accessibilityRole="button" aria-selected={actif}
                         accessibilityLabel={`${etiquette} : ${r.nom}`}
                         style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                  backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{r.nom}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {!!aide && <Text style={S.petit}>{aide}</Text>}
    </View>
  );
}
