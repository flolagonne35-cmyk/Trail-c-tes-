// Briques d'interface communes aux écrans : en-tête, tuiles de chiffres, puces, ajusteur, navigation.

import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { C, S } from "../theme.ts";

export function EnTete({ surtitre, titre, sousTitre, retour }: {
  surtitre: string; titre: string; sousTitre?: string; retour?: () => void;
}) {
  return (
    <View style={{ paddingTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8 }}>
        {retour && (
          <Pressable onPress={retour} accessibilityRole="button" accessibilityLabel="Retour"
                     style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable,
                              alignItems: "center", justifyContent: "center" }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={C.encre} strokeWidth={2}
                 strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
          </Pressable>
        )}
        <Text style={S.surtitre}>{surtitre}</Text>
      </View>
      <Text style={S.titre} accessibilityRole="header">{titre}</Text>
      {sousTitre ? <Text style={S.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

export function Tuiles({ valeurs }: { valeurs: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
      {valeurs.map(([etiquette, valeur]) => (
        <View key={etiquette} style={{ flex: 1, backgroundColor: C.sable, borderRadius: 12, paddingVertical: 10,
                                       paddingHorizontal: 12 }}>
          <Text style={S.petit}>{etiquette}</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: C.encre, marginTop: 2 }}>{valeur}</Text>
        </View>
      ))}
    </View>
  );
}

export function Puce({ texte, actif, onPress }: { texte: string; actif?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={onPress ? "button" : "text"}
               aria-selected={onPress ? !!actif : undefined}
               style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, minHeight: 36,
                        justifyContent: "center", backgroundColor: actif ? C.encre : C.sable }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: actif ? C.fond : C.encre }}>{texte}</Text>
    </Pressable>
  );
}

export function Ajusteur({ etiquette, valeur, unite, pas, min = 0, max = 10000, onChange }: {
  etiquette: string; valeur: number; unite: string; pas: number; min?: number; max?: number;
  onChange: (v: number) => void;
}) {
  const bouton = (signe: -1 | 1) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${signe < 0 ? "Moins" : "Plus"} ${pas} ${unite}, ${etiquette}`}
               onPress={() => onChange(Math.min(max, Math.max(min, Math.round((valeur + signe * pas) / pas) * pas)))}
               style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable, alignItems: "center",
                        justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: C.encre }}>{signe < 0 ? "−" : "+"}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{etiquette}</Text>
      {bouton(-1)}
      <Text style={{ fontSize: 16, fontWeight: "700", color: C.encre, minWidth: 76, textAlign: "center" }}>
        {nombre(valeur, pas < 1 && valeur % 1 ? 2 : 0)} {unite}
      </Text>
      {bouton(1)}
    </View>
  );
}

/** Onglets de la barre du bas. */
export type Onglet = "accueil" | "cotes" | "entrainement" | "course" | "nutrition";
/** Toutes les pages : les onglets, plus celles du menu. */
export type Page = Onglet | "courses" | "profil" | "sources";

export const ICONES = {
  accueil: <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  cotes: <><Path d="M3 19l6-9 4 5 3-4 5 8z" /><Circle cx={16.5} cy={5.5} r={1.5} /></>,
  course: <><Path d="M5 21V4" /><Path d="M5 4h11l-2 4 2 4H5" /></>,
  profil: <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  entrainement: <><Circle cx={14} cy={4.5} r={1.8} /><Path d="M9 21l2.5-5.5L14 17v4M11.5 15.5L13 9l-3 1.5-1.5 3M13 9l2.5 2.5H19" /></>,
  menu: <Path d="M4 7h16M4 12h16M4 17h16" />,
  calendrier: <><Path d="M5 5h14v15H5z" /><Path d="M5 10h14M9 3v4M15 3v4" /></>,
  info: <><Circle cx={12} cy={12} r={9} /><Path d="M12 11v6M12 7.5v.5" /></>,
  fermer: <Path d="M6 6l12 12M18 6L6 18" />,
  recherche: <><Circle cx={11} cy={11} r={6.5} /><Path d="M16 16l5 5" /></>,
  filtres: <Path d="M4 6h16M7 12h10M10 18h4" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  gpx: <><Path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" /><Path d="M14 3v4h4M9 14l2 2 4-4" /></>,
  nutrition: <Path d="M7 3v8a3 3 0 0 0 6 0V3M10 11v10M17 3c-2 2-3 5-3 8h3v10" />,
  chrono: <><Circle cx={12} cy={13} r={8} /><Path d="M12 9v4l3 2M10 2h4" /></>,
  trophee: <><Path d="M8 4h8v5a4 4 0 0 1-8 0z" /><Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4" /></>,
  fleche: <Path d="M9 6l6 6-6 6" />,
  boucle: <><Path d="M20 12a8 8 0 1 1-2.4-5.7" /><Path d="M20 4v4h-4" /><Circle cx={12} cy={12} r={1.5} /></>,
  seance: <Path d="M5 20v-6M10 20V8M15 20v-9M20 20V5" />,
  position: <><Circle cx={12} cy={12} r={7} /><Circle cx={12} cy={12} r={2.5} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
} as const;

export function Icone({ nom, couleur = C.encre, taille = 22 }: { nom: keyof typeof ICONES; couleur?: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round">{ICONES[nom]}</Svg>
  );
}

const NOMS: Record<Onglet, string> = {
  accueil: "Accueil", cotes: "Côtes", entrainement: "S'entraîner", course: "Course", nutrition: "Nutrition",
};

/** Titre de section, avec une action facultative à droite. */
export function Section({ titre, action, onAction, children }: {
  titre: string; action?: string; onAction?: () => void; children?: ReactNode;
}) {
  return (
    <View style={{ marginTop: 22, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={S.h2} accessibilityRole="header">{titre}</Text>
        {action && onAction && (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** Choix exclusif en ligne (sous-onglets d'un écran). */
export function Segments<T extends string>({ options, valeur, onChange }: {
  options: [T, string][]; valeur: T; onChange: (v: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: C.sable, borderRadius: 14, padding: 4 }}>
      {options.map(([v, nom]) => {
        const actif = v === valeur;
        return (
          <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="tab" aria-selected={actif}
                     style={{ flex: 1, minHeight: 40, borderRadius: 11, alignItems: "center", justifyContent: "center",
                              backgroundColor: actif ? C.blanc : "transparent" }}>
            <Text style={{ fontSize: 14, fontWeight: actif ? "700" : "600", color: actif ? C.encre : C.gris }}>{nom}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Navigation({ actif, onChange, basSur }: { actif: Page; onChange: (o: Onglet) => void; basSur: number }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: C.blanc, paddingTop: 8,
                                               paddingHorizontal: 4, paddingBottom: Math.max(16, basSur),
                                               borderTopWidth: 1, borderTopColor: C.aire }}>
      {(Object.keys(NOMS) as Onglet[]).map((o) => {
        const couleur = o === actif ? C.montee : C.gris;
        return (
          <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="tab" aria-selected={o === actif}
                     style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: 8, minHeight: 44 }}>
            <Icone nom={o} couleur={couleur} />
            <Text style={{ fontSize: 11, color: couleur, fontWeight: o === actif ? "700" : "500" }} numberOfLines={1}>{NOMS[o]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const nombre = (v: number, decimales = 0) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Barre du haut de chaque page : menu (toutes les sections), titre, accès au profil. */
export function BarreHaut({ titre, onMenu, onProfil, avatar }: {
  titre: string; onMenu: () => void; onProfil: () => void; avatar: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 6,
                   backgroundColor: C.fond }}>
      <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Menu : toutes les sections"
                 style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.blanc }}>
        <Icone nom="menu" />
      </Pressable>
      <Text style={{ flex: 1, fontSize: 18, fontWeight: "800", color: C.encre }} numberOfLines={1} accessibilityRole="header">{titre}</Text>
      <Pressable onPress={onProfil} accessibilityRole="button" accessibilityLabel="Mon profil"
                 style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: C.blanc }}>
        {avatar}
      </Pressable>
    </View>
  );
}
