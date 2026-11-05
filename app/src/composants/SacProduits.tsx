// « Mon sac à produits » (nutrition) : je coche ce que j'emporte, l'appli le traduit en produits par
// heure et pour toute la course, avec le coût.

import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { heuresLisibles } from "../calcul/nutrition.ts";
import { heureType, PRODUITS, sacCourse } from "../calcul/produits.ts";
import { chargerChiffres, enregistrerChiffres } from "../mesChiffres.ts";
import { C, S } from "../theme.ts";
import { nombre } from "./communs.tsx";

const euros = (v: number) => `${nombre(v, 2)} €`;

export function SacProduits({ glucides, sodium, eau, heures }: { glucides: number; sodium: number; eau: number; heures: number }) {
  const [choisis, setChoisisEtat] = useState<string[]>(["gel", "boisson", "compote", "sel"]);
  useEffect(() => { chargerChiffres().then((c) => { if (c.produits) setChoisisEtat(c.produits); }); }, []);
  const setChoisis = (ids: string[]) => {
    setChoisisEtat(ids);
    chargerChiffres().then((c) => enregistrerChiffres({ ...c, produits: ids }));
  };
  const h = useMemo(() => heureType(choisis, glucides, sodium, eau), [choisis, glucides, sodium, eau]);
  const sac = sacCourse(h, heures);
  return (
    <View style={[S.carte, { gap: 12 }]}>
      <Text style={S.h2}>Mon sac à produits</Text>
      <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>Coche ce que tu aimes emporter : l'appli compose chaque heure de course.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRODUITS.map((p) => {
          const actif = choisis.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => setChoisis(actif ? choisis.filter((x) => x !== p.id) : [...choisis, p.id])}
                       accessibilityRole="checkbox" aria-checked={actif} accessibilityLabel={`${p.nom}, ${p.detail}`}
                       style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, justifyContent: "center",
                                backgroundColor: actif ? C.encre : C.fond, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: actif ? C.fond : C.encre }}>{actif ? "✓ " : ""}{p.nom}</Text>
            </Pressable>
          );
        })}
      </View>
      {h.produits.length ? (
        <>
          <View style={{ gap: 6, backgroundColor: C.monteeClair, borderRadius: 14, padding: 12 }}>
            <Text style={[S.fort, { color: C.monteeFonce }]}>Chaque heure</Text>
            {h.produits.map((x) => (
              <Text key={x.produit.id} style={[S.fort, { fontWeight: "600" }]}>
                {String(x.n).replace(".", ",")} × {x.produit.nom.toLowerCase()} <Text style={S.petit}>({x.produit.detail})</Text>
              </Text>
            ))}
            <Text style={S.petit}>
              = {nombre(h.glucides)} g de glucides (visé {glucides}), {nombre(h.sodium)} mg de sodium (visé {sodium})
              {h.cafeine ? `, ${h.cafeine} mg de caféine : plutôt après la première moitié de course` : ""}.
            </Text>
          </View>
          <Text style={S.fort}>Pour toute la course ({heuresLisibles(heures)})</Text>
          <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
            {sac.produits.map((x) => `${x.n} × ${x.produit.nom.toLowerCase()}`).join(" · ")} — environ {euros(sac.prix)}
          </Text>
        </>
      ) : <Text style={S.petit}>Coche au moins un produit.</Text>}
      <Text style={S.petit}>
        Valeurs indicatives de produits courants : vérifie l'étiquette des tiens. Ne teste jamais un produit nouveau le jour de la course.
      </Text>
    </View>
  );
}
