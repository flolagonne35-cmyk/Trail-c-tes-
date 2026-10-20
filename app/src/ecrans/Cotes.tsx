// Écran « Côtes à proximité » : filtres (pente, type de voie, rayon), carte schématique, liste triée.

import { Pressable, ScrollView, Text, View } from "react-native";

import { kmLisibles, type CoteProche, type Filtres, type TypeVoie } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { EnTete, nombre, Puce } from "../composants/communs.tsx";
import { CarteCotes } from "../composants/graphiques.tsx";
import { C, S } from "../theme.ts";

const PENTES = [5, 8, 10];
const RAYONS = [2000, 5000, 10000];
const TYPES: [TypeVoie, string][] = [["route", "Route"], ["chemin", "Chemin"], ["sentier", "Sentier"]];

export function EcranCotes({ cotes, position, sourcePosition, filtres, setFiltres, onChoisir, source }: {
  cotes: CoteProche[]; position: Position; sourcePosition: string; filtres: Filtres;
  setFiltres: (f: Filtres) => void; onChoisir: (c: CoteProche, rang: number) => void; source: string;
}) {
  const basculer = (t: TypeVoie) => {
    const groupe: TypeVoie[] = t === "route" ? ["route", "piste cyclable"] : [t]; // pistes cyclables avec les routes
    const types = filtres.types.includes(t)
      ? filtres.types.filter((x) => !groupe.includes(x))
      : [...filtres.types, ...groupe];
    setFiltres({ ...filtres, types });
  };
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <EnTete surtitre="Autour de moi" titre="Côtes à proximité"
              sousTitre={`Rayon ${filtres.rayonM / 1000} km · ${sourcePosition}`} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {PENTES.map((p) => (
          <Puce key={p} texte={`Pente ≥ ${p} %`} actif={filtres.penteMin === p}
                onPress={() => setFiltres({ ...filtres, penteMin: p })} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {TYPES.map(([t, nom]) => (
          <Puce key={t} texte={nom} actif={filtres.types.includes(t)} onPress={() => basculer(t)} />
        ))}
        {RAYONS.map((r) => (
          <Puce key={r} texte={`${r / 1000} km`} actif={filtres.rayonM === r}
                onPress={() => setFiltres({ ...filtres, rayonM: r })} />
        ))}
      </View>

      <View style={{ marginTop: 12, borderRadius: 16, overflow: "hidden" }}>
        <CarteCotes position={position} cotes={cotes} rayonM={filtres.rayonM} />
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
        {cotes.length === 0 && (
          <Text style={[S.petit, { textAlign: "center", padding: 16 }]}>
            Aucune côte avec ces filtres. Élargissez le rayon ou baissez la pente minimale.
          </Text>
        )}
        {cotes.map((c, i) => (
          <Pressable key={c.id} onPress={() => onChoisir(c, i + 1)} accessibilityRole="button"
                     accessibilityLabel={`Côte ${i + 1} : ${Math.round(c.longueur_m)} mètres à ${c.pente_moy_pct} %, à ${kmLisibles(c.distance_m)}`}
                     style={S.ligne}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: i === 0 ? C.monteeFonce : C.montee,
                           alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.blanc, fontWeight: "700", fontSize: 14 }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={S.fort}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {nombre(c.pente_moy_pct, 1)} %</Text>
              <Text style={S.petit} numberOfLines={1}>
                +{nombre(c.dplus_m)} m · {[c.revetement.replace(" (supposé)", ""), c.type_voie].filter(Boolean).join(" · ")}
                {" "}· max {nombre(c.pente_max_pct)} %{c.nom ? ` · ${c.nom}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={S.fort}>{kmLisibles(c.distance_m)}</Text>
              <Text style={S.petit}>de toi</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={[S.petit, { marginTop: 16 }]}>
        Altitudes IGN RGE ALTI et réseau BD TOPO (Licence Ouverte) · revêtements © contributeurs OpenStreetMap (ODbL)
        · {source}
      </Text>
    </ScrollView>
  );
}
