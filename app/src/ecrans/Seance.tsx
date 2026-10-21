// Côtes → Séance : on écrit la séance du coach (« 8 × 400 m à 10 % ») et l'appli propose les
// trois endroits les plus proches qui collent, avec départ, arrivée, durée et export GPX.

import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { kmLisibles, type Cote, type CoteProche, type Filtres, type Sens } from "../calcul/cotes.ts";
import type { Position } from "../calcul/geo.ts";
import { ecrireGpx } from "../calcul/gpx.ts";
import { chercherSeance, EXEMPLES_SEANCES, lireSeance, pointA, type Proposition } from "../calcul/seances.ts";
import { dureeLisible } from "../calcul/trajets.ts";
import { centreDe, zoomAjuste } from "../calcul/tuiles.ts";
import { Carte, couleurPente } from "../composants/Carte.tsx";
import { nombre, Puce, Segments } from "../composants/communs.tsx";
import { partagerFichier } from "../fichiers.ts";
import { C, S } from "../theme.ts";

function tracePortion(p: Proposition): Position[] {
  const pts: Position[] = [];
  for (let s = p.debutM; s < p.finM; s += 20) pts.push(pointA(p.cote, s));
  pts.push(p.arrivee);
  return pts;
}

function exporterSeance(p: Proposition, reps: number) {
  const nom = `${reps} × ${nombre(p.finM - p.debutM)} m à ${p.sens === "descente" ? "−" : ""}${nombre(p.pente, 1)} %`;
  return partagerFichier(`seance-${p.cote.id}.gpx`, ecrireGpx(nom, tracePortion(p)));
}

function CarteProposition({ p, rang, reps, onOuvrir }: { p: Proposition; rang: number; reps: number; onOuvrir: () => void }) {
  const trace = tracePortion(p);
  const descente = p.sens === "descente";
  return (
    <View style={[S.carte, { gap: 10 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: rang === 1 ? C.encre : C.sable,
                       alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontWeight: "800", color: rang === 1 ? C.fond : C.encre }}>{rang}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={S.fort}>{nombre(p.finM - p.debutM)} m à {descente ? "−" : ""}{nombre(p.pente, 1)} %</Text>
          <Text style={S.petit} numberOfLines={1}>{p.cote.adresse || p.cote.nom || p.cote.type_voie} · à {kmLisibles(p.distance_m)}</Text>
        </View>
      </View>
      {(p.ecartPente > 1.5 || p.courte) && (
        <Text style={{ fontSize: 12, color: C.monteeFonce, fontWeight: "600" }}>
          {p.courte ? `Côte un peu courte (${nombre(p.cote.longueur_m)} m). ` : ""}
          {p.ecartPente > 1.5 ? `Pente la plus proche trouvée, à ${nombre(p.ecartPente, 1)} point${p.ecartPente >= 2 ? "s" : ""} de la cible.` : ""}
        </Text>
      )}
      <Carte hauteur={170} cle={`seance-${p.cote.id}-${p.debutM}`} centre={centreDe(trace)} zoom={zoomAjuste(trace, 340, 170, 13, 17)}
             traces={[{ id: p.cote.id, points: trace, couleur: couleurPente(p.pente), epaisseur: 6 }]}
             marqueurs={[
               { id: "d", position: p.depart, texte: "D", couleur: C.descente, label: "Départ de la répétition" },
               { id: "a", position: p.arrivee, texte: "A", couleur: C.encre, label: "Fin de la répétition" },
             ]} />
      <Text style={[S.petit, { color: C.encre }]}>
        Départ {p.debutM > 0 ? `à ${nombre(p.debutM)} m du ${descente ? "sommet" : "pied"}` : `au ${descente ? "sommet" : "pied"}`} ·
        {" "}{descente ? "−" : "+"}{nombre(p.dplusM)} m par répétition · {reps} × ≈ {dureeLisible(p.minutesEffort)} d'effort
      </Text>
      <Text style={S.petit}>
        Séance ≈ {dureeLisible(p.minutesTotal)} avec les retours en trottinant (hors échauffement) ·
        {" "}{descente ? "D−" : "D+"} total {nombre(reps * p.dplusM)} m
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={onOuvrir} accessibilityRole="button" style={[S.boutonClair, { flex: 1 }]}>
          <Text style={S.boutonClairTexte}>Voir {descente ? "la descente" : "la côte"}</Text>
        </Pressable>
        <Pressable onPress={() => exporterSeance(p, reps)} accessibilityRole="button" style={[S.bouton, { flex: 1 }]}>
          <Text style={S.boutonTexte}>GPX montre</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function VueSeance({ toutes, position, filtres, allurePlat, onChoisir, texteInitial }: {
  toutes: Cote[]; position: Position; filtres: Filtres; allurePlat: number; onChoisir: (c: CoteProche, rang: number) => void;
  texteInitial?: string;
}) {
  const [texte, setTexte] = useState(texteInitial ?? "8 × 400 m à 10 %");
  const [sens, setSens] = useState<Sens>("montee");
  const seance = lireSeance(texte);
  const propositions = useMemo(
    () => (seance ? chercherSeance(toutes, position, seance, sens, filtres, allurePlat) : []),
    [toutes, position, seance?.repetitions, seance?.longueurM, seance?.pente, sens, filtres, allurePlat], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <Text style={S.petit}>Écris la séance de ton coach : nombre de répétitions, longueur et pente visée.</Text>
      <TextInput value={texte} onChangeText={setTexte} placeholder="ex. 8 × 400 m à 10 %" accessibilityLabel="Séance"
                 autoCorrect={false}
                 style={{ backgroundColor: C.blanc, borderRadius: 14, paddingHorizontal: 14, minHeight: 52, fontSize: 18,
                          fontWeight: "700", color: C.encre, borderWidth: 2, borderColor: seance ? C.encre : C.montee }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EXEMPLES_SEANCES.map((e) => <Puce key={e} texte={e} actif={e === texte} onPress={() => setTexte(e)} />)}
      </View>
      <Segments options={[["montee", "En montée"], ["descente", "En descente"]]} valeur={sens} onChange={setSens} />
      {!seance ? (
        <Text style={{ color: C.monteeFonce, fontWeight: "600" }}>
          Format attendu : « 8 × 400 m à 10 % », « 6 x 1 km à 6 % » ou « 10 × 200 m » (sans pente : la plus raide).
        </Text>
      ) : (
        <Text style={S.fort}>
          {seance.repetitions} × {nombre(seance.longueurM)} m {seance.pente !== null ? `à ${sens === "descente" ? "−" : ""}${nombre(seance.pente, 1)} %` : "le plus raide possible"} :
          {" "}{propositions.length ? `${propositions.length} endroit${propositions.length > 1 ? "s" : ""}` : "aucun endroit assez long"}
        </Text>
      )}
      {propositions.map((p, i) => (
        <CarteProposition key={`${p.cote.id}-${p.debutM}`} p={p} rang={i + 1} reps={seance!.repetitions}
                          onOuvrir={() => onChoisir({ ...p.cote, distance_m: p.distance_m }, i + 1)} />
      ))}
      <Text style={S.petit}>
        On cherche dans chaque {sens === "descente" ? "descente" : "côte"} la portion de la bonne longueur dont la pente est la plus
        proche de la cible (± 1,5 point), puis la plus proche de toi. Les filtres de voie, de sol et de trafic de l'onglet Côtes s'appliquent.
      </Text>
    </View>
  );
}
