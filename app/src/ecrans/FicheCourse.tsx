// Éléments de l'écran « Courses à venir » : la fiche d'une course (date, lieu, formats, site
// officiel, ajout à mes courses, préparation d'un format) et le choix d'un département.

import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import { formatsLisibles, type CourseProche } from "../calcul/agenda.ts";
import { normaliser } from "../calcul/communes.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import { DEPARTEMENTS, REGIONS } from "../calcul/regions.ts";
import { nombre } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";

export const champ = { backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: C.encre } as const;
export const jour = (d: string) => new Date(`${d}T12:00:00`);

export function LigneCourse({ c, numero, deja, onAjouter, onPreparer }: {
  c: CourseProche; numero?: number; deja: boolean; onAjouter: () => void; onPreparer: (km: number | null) => void;
}) {
  const d = jour(c.date);
  const plusieurs = c.date !== c.fin;
  return (
    <View style={[S.carte, { marginTop: 0, gap: 8, padding: 14 }]}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ width: 52, alignItems: "center", backgroundColor: c.type === "trail" ? C.monteeClair : C.platClair, borderRadius: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.gris, textTransform: "uppercase" }}>{d.toLocaleDateString("fr-FR", { weekday: "short" })}</Text>
          <Text style={{ fontSize: 22, fontWeight: "900", color: C.encre }}>{d.getDate()}</Text>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.gris }}>{d.toLocaleDateString("fr-FR", { month: "short" })}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={S.fort} numberOfLines={2}>{numero ? `${numero}. ` : ""}{c.nom}</Text>
          <Text style={S.petit} numberOfLines={1}>
            {c.commune}{c.cp ? ` (${c.cp.slice(0, 2)})` : ""} · à {kmLisibles(c.distance_m)}{plusieurs ? ` · jusqu'au ${jour(c.fin).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}
          </Text>
          <Text style={[S.petit, { color: C.encre }]}>
            {c.type === "trail" ? "Trail" : "Route"}{c.distances_km.length ? ` · ${formatsLisibles(c.distances_km)}` : " · formats sur le site officiel"}
            {c.dplus_m ? ` · ${nombre(c.dplus_m)} m D+` : ""}
          </Text>
        </View>
      </View>
      {c.distances_km.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <Text style={S.petit}>Préparer le</Text>
          {c.distances_km.map((km) => (
            <Pressable key={km} onPress={() => onPreparer(km)} accessibilityRole="button" accessibilityLabel={`Préparer le ${km} km de ${c.nom}`}
                       style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: "center", backgroundColor: C.encre }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.fond }}>{String(km).replace(".", ",")} km</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!!c.site && (
          <Pressable onPress={() => Linking.openURL(c.site)} accessibilityRole="link" accessibilityLabel={`Site officiel de ${c.nom}`}
                     style={[S.boutonClair, { flex: 1, minHeight: 40 }]}>
            <Text style={[S.boutonClairTexte, { fontSize: 14 }]}>Site officiel</Text>
          </Pressable>
        )}
        <Pressable onPress={onAjouter} disabled={deja} aria-disabled={deja} accessibilityRole="button"
                   accessibilityLabel={deja ? `${c.nom} est dans mes courses` : `Ajouter ${c.nom} à mes courses`}
                   style={[S.boutonClair, { flex: 1, minHeight: 40, opacity: deja ? 0.5 : 1 }]}>
          <Text style={[S.boutonClairTexte, { fontSize: 14 }]}>{deja ? "Dans mes courses ✓" : "Ajouter à mes courses"}</Text>
        </Pressable>
      </View>
      {!c.distances_km.length && (
        <Pressable onPress={() => onPreparer(null)} accessibilityRole="button" accessibilityLabel={`Préparer ${c.nom}`} hitSlop={6}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.montee }}>Préparer cette course (je saisis le format)</Text>
        </Pressable>
      )}
      <Text style={[S.petit, { fontSize: 11 }]}>Source : {c.auteur ? `${c.auteur}, via ` : ""}{c.source}{c.maj ? `, mis à jour le ${jour(c.maj).toLocaleDateString("fr-FR")}` : ""}</Text>
    </View>
  );
}

/** Choix d'un département : on tape un nom ou un numéro ; ceux de la région du lieu sont proposés d'abord. */
export function ChoixDepartement({ actuel, depLieu, onChoisir }: { actuel?: string; depLieu: string; onChoisir: (code: string) => void }) {
  const [q, setQ] = useState("");
  const region = REGIONS.find((r) => r.departements.includes(depLieu));
  const n = normaliser(q);
  const codes = n
    ? Object.keys(DEPARTEMENTS).filter((d) => d.toLowerCase().startsWith(n) || normaliser(DEPARTEMENTS[d]).includes(n)).slice(0, 12)
    : [...(region?.departements ?? []), ...Object.keys(DEPARTEMENTS).filter((d) => !region?.departements.includes(d))].slice(0, 8);
  return (
    <View style={{ gap: 8 }}>
      <TextInput value={q} onChangeText={setQ} placeholder="Nom ou numéro (ex. Finistère, 29)" autoCorrect={false}
                 accessibilityLabel="Chercher un département" style={champ} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {codes.map((d) => {
          const actif = d === actuel;
          return (
            <Pressable key={d} onPress={() => onChoisir(d)} accessibilityRole="button" aria-selected={actif}
                       accessibilityLabel={`Département ${DEPARTEMENTS[d]} (${d})`}
                       style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: "center",
                                backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: actif ? C.fond : C.encre }}>{DEPARTEMENTS[d]} ({d})</Text>
            </Pressable>
          );
        })}
        {!codes.length && <Text style={S.petit}>Aucun département ne correspond.</Text>}
      </View>
    </View>
  );
}
