// Écran « Côtes à proximité » : se localiser ou chercher une ville / une adresse, filtres,
// carte schématique, côtes les plus proches avec adresse du pied et temps pour y aller.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { cotesProches, kmLisibles, type Cote, type CoteProche, type Filtres, type TypeVoie } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { adresseDe, rechercherLieux, type Lieu } from "../calcul/geoservices.ts";
import { dureeLisible, tempsTrajets } from "../calcul/trajets.ts";
import { EnTete, nombre, Puce } from "../composants/communs.tsx";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { zoomAjuste } from "../calcul/tuiles.ts";
import { C, S } from "../theme.ts";

const PENTES = [5, 8, 10];
const RAYONS = [2000, 5000, 10000, 25000];
const TYPES: [TypeVoie, string][] = [["route", "Route"], ["chemin", "Chemin"], ["sentier", "Sentier"]];
// points de départ rapides, utiles sans localisation ni réseau (centres de quartier approximatifs)
const LIEUX_RAPIDES: Lieu[] = [
  { label: "Rennes centre (Mairie)", detail: "", lat: 48.1113, lon: -1.6800 },
  { label: "Parc du Thabor", detail: "", lat: 48.1144, lon: -1.6697 },
  { label: "Les Gayeulles", detail: "", lat: 48.1336, lon: -1.6372 },
  { label: "Villejean", detail: "", lat: 48.1210, lon: -1.7020 },
  { label: "Bréquigny", detail: "", lat: 48.0885, lon: -1.6840 },
  { label: "Cesson-Sévigné", detail: "", lat: 48.1210, lon: -1.6030 },
];

function Recherche({ position, onLieu, onLocaliser, enCours }: {
  position: Position; onLieu: (l: Lieu) => void; onLocaliser: () => void; enCours: boolean;
}) {
  const [q, setQ] = useState("");
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (q.trim().length < 3) {
      setLieux([]);
      return;
    }
    minuteur.current = setTimeout(() => {
      rechercherLieux(q.trim(), position)
        .then((r) => { setLieux(r); setErreur(r.length ? null : "Aucun lieu trouvé."); })
        .catch(() => setErreur("Recherche indisponible (réseau ?)."));
    }, 350);
    return () => { if (minuteur.current) clearTimeout(minuteur.current); };
  }, [q, position]);

  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Ville, adresse, lieu…" returnKeyType="search"
                   accessibilityLabel="Chercher une ville ou une adresse" autoCorrect={false}
                   style={{ flex: 1, minWidth: 0, backgroundColor: C.blanc, borderRadius: 14, paddingHorizontal: 14,
                            minHeight: 48, fontSize: 15, color: C.encre }} />
        <Pressable onPress={onLocaliser} accessibilityRole="button" accessibilityLabel="Me localiser"
                   style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.encre, alignItems: "center",
                            justifyContent: "center" }}>
          {enCours ? <ActivityIndicator color={C.fond} /> : (
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={C.fond} strokeWidth={2} strokeLinecap="round">
              <Circle cx={12} cy={12} r={7} /><Circle cx={12} cy={12} r={2.5} fill={C.fond} />
              <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </Svg>
          )}
        </Pressable>
      </View>
      {lieux.length > 0 && (
        <View style={{ backgroundColor: C.blanc, borderRadius: 14, marginTop: 6, overflow: "hidden" }}>
          {lieux.map((l, i) => (
            <Pressable key={`${l.label}-${i}`} accessibilityRole="button"
                       onPress={() => { onLieu(l); setQ(""); setLieux([]); }}
                       style={{ paddingVertical: 10, paddingHorizontal: 14, minHeight: 44, justifyContent: "center",
                                borderTopWidth: i ? 1 : 0, borderTopColor: C.aire }}>
              <Text style={{ fontSize: 15, color: C.encre }}>{l.label}</Text>
              {l.detail ? <Text style={S.petit}>{l.detail}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
      {erreur && q.trim().length >= 3 && !lieux.length && <Text style={[S.petit, { marginTop: 6 }]}>{erreur}</Text>}
      {!lieux.length && (
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {LIEUX_RAPIDES.map((l) => <Puce key={l.label} texte={l.label} onPress={() => onLieu(l)} />)}
        </View>
      )}
    </View>
  );
}

function LigneCote({ c, rang, position, allurePlat, onPress, adresse }: {
  c: CoteProche; rang: number; position: Position; allurePlat: number; onPress: () => void; adresse?: string | null;
}) {
  const t = tempsTrajets(position, { lat: c.lat, lon: c.lon }, allurePlat);
  const voiture = t.find((x) => x.mode === "voiture")!;
  const course = t.find((x) => x.mode === "course")!;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
               accessibilityLabel={`Côte ${rang} : ${Math.round(c.longueur_m)} mètres à ${c.pente_moy_pct} %, à ${kmLisibles(c.distance_m)}${adresse ? `, ${adresse}` : ""}`}
               style={[S.ligne, { alignItems: "flex-start" }]}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: rang === 1 ? C.monteeFonce : C.montee,
                     alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.blanc, fontWeight: "700", fontSize: 14 }}>{rang}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.fort}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {nombre(c.pente_moy_pct, 1)} %</Text>
        <Text style={S.petit} numberOfLines={1}>
          +{nombre(c.dplus_m)} m · {[c.revetement.replace(" (supposé)", ""), c.type_voie].filter(Boolean).join(" · ")}
          {" "}· max {nombre(c.pente_max_pct)} %
        </Text>
        <Text style={[S.petit, { color: C.encre, marginTop: 2 }]} numberOfLines={2}>
          {adresse ?? (c.nom || "Adresse en cours…")}
        </Text>
        <Text style={[S.petit, { marginTop: 2 }]}>
          ≈ {dureeLisible(voiture.minutes)} en voiture · {dureeLisible(course.minutes)} en courant
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={S.fort}>{kmLisibles(c.distance_m)}</Text>
        <Text style={S.petit}>à vol d'oiseau</Text>
      </View>
    </Pressable>
  );
}

export function EcranCotes({ cotes, toutes, position, sourcePosition, filtres, setFiltres, onChoisir, source,
                             allurePlat, onLocaliser, onLieu }: {
  cotes: CoteProche[]; toutes: Cote[]; position: Position; sourcePosition: string; filtres: Filtres;
  setFiltres: (f: Filtres) => void; onChoisir: (c: CoteProche, rang: number) => void; source: string;
  allurePlat: number; onLocaliser: () => void; onLieu: (l: Lieu) => void;
}) {
  const basculer = (t: TypeVoie) => {
    const groupe: TypeVoie[] = t === "route" ? ["route", "piste cyclable"] : [t]; // pistes cyclables avec les routes
    const types = filtres.types.includes(t)
      ? filtres.types.filter((x) => !groupe.includes(x))
      : [...filtres.types, ...groupe];
    setFiltres({ ...filtres, types });
  };
  // aucune côte dans le rayon : on montre quand même les plus proches
  const auDela = useMemo(
    () => (cotes.length ? [] : cotesProches(toutes, position, { ...filtres, rayonM: Infinity }).slice(0, 5)),
    [cotes, toutes, position, filtres],
  );
  const affichees = cotes.length ? cotes : auDela;

  // adresses du pied des 10 premières côtes (géocodage inverse, mis en cache)
  const [adresses, setAdresses] = useState<Record<number, string | null>>({});
  useEffect(() => {
    let actif = true;
    affichees.slice(0, 10).forEach((c) => {
      if (c.id in adresses || c.adresse) return; // déjà connue (précalcul ou requête précédente)
      adresseDe({ lat: c.lat, lon: c.lon }).then((a) => { if (actif) setAdresses((x) => ({ ...x, [c.id]: a })); });
    });
    return () => { actif = false; };
  }, [affichees]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <EnTete surtitre="Autour de" titre="Côtes à proximité" sousTitre={sourcePosition} />
      <Recherche position={position} onLieu={onLieu} onLocaliser={onLocaliser} enCours={sourcePosition === "localisation…"} />
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
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {RAYONS.map((r) => (
          <Puce key={r} texte={`${r / 1000} km`} actif={filtres.rayonM === r}
                onPress={() => setFiltres({ ...filtres, rayonM: r })} />
        ))}
      </View>

      <View style={{ marginTop: 12 }}>
        <Carte hauteur={320} centre={position} position={position} rayonM={cotes.length ? filtres.rayonM : undefined}
               zoom={zoomAjuste([position, ...affichees.slice(0, 10).map((c) => ({ lat: c.lat, lon: c.lon }))], 360, 320, 11, 16)}
               cle={`${position.lat},${position.lon},${affichees.map((c) => c.id).join("-")}`}
               traces={affichees.map((c) => ({ id: c.id, couleur: couleurPente(c.pente_moy_pct),
                                               points: c.geometrie.map(([lon, lat]) => ({ lat, lon })) }))}
               marqueurs={affichees.slice(0, 15).map((c, i) => ({
                 id: String(c.id), position: { lat: c.lat, lon: c.lon }, texte: String(i + 1),
                 couleur: i === 0 ? C.encre : couleurPente(c.pente_moy_pct),
                 label: `Côte ${i + 1}, ${Math.round(c.longueur_m)} mètres à ${c.pente_moy_pct} %`,
                 onPress: () => onChoisir(c, i + 1),
               }))} />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
          {[[C.monteeDouce, "< 7 %"], [C.montee, "7 – 10 %"], [C.monteeFonce, "≥ 10 %"]].map(([couleur, texte]) => (
            <View key={texte} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 16, height: 5, borderRadius: 3, backgroundColor: couleur }} />
              <Text style={S.petit}>{texte}</Text>
            </View>
          ))}
          <Text style={S.petit}>· touchez un numéro pour ouvrir la côte</Text>
        </View>
      </View>

      {!cotes.length && (
        <Text style={[S.petit, { textAlign: "center", padding: 12 }]}>
          {auDela.length
            ? `Aucune côte dans un rayon de ${filtres.rayonM / 1000} km. Voici les plus proches.`
            : "Aucune côte avec ces filtres. Baissez la pente minimale ou ajoutez des types de voie."}
        </Text>
      )}
      <View style={{ gap: 8, marginTop: 12 }}>
        {affichees.map((c, i) => (
          <LigneCote key={c.id} c={c} rang={i + 1} position={position} allurePlat={allurePlat}
                     adresse={c.adresse || adresses[c.id]} onPress={() => onChoisir(c, i + 1)} />
        ))}
      </View>
      <Text style={[S.petit, { marginTop: 16 }]}>
        Temps estimés depuis le point choisi ; le détail d'une côte donne l'itinéraire calculé. Altitudes IGN RGE ALTI,
        réseau BD TOPO et adresses BAN (Licence Ouverte) · revêtements © contributeurs OpenStreetMap (ODbL) · {source}
      </Text>
    </ScrollView>
  );
}
