// Onglet « S'entraîner » : la séance du coach, la boucle sur mesure, et mes progrès
// (chronos sur mes côtes, mon allure selon la pente), depuis un même point de départ.

import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { allureLisible, TRANCHES, type Modele } from "../calcul/allure.ts";
import { distanceCouverture, RAYON_COUVERTURE_M, type Cote, type CoteProche, type Filtres } from "../calcul/cotes.ts";
import { distanceM } from "../calcul/geo.ts";
import type { Lieu } from "../calcul/geoservices.ts";
import { cleCote, mesPassages, vitesseAscensionnelle, type Activite } from "../calcul/points.ts";
import { BarreDepart, type Localisation, type PointDepart } from "../composants/BarreDepart.tsx";
import { nombre, Section, Segments } from "../composants/communs.tsx";
import { couleurPente } from "../composants/Carte.tsx";
import { C, S } from "../theme.ts";
import { VueBoucle } from "./Boucle.tsx";
import { HorsZone } from "./Cotes.tsx";
import type { PresetSortie } from "./Plan.tsx";
import { VueSeance } from "./Seance.tsx";

export type ModeEntrainement = "seance" | "boucle" | "progres";

const chrono = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function MonAllure({ modele }: { modele: Modele | null }) {
  return (
    <Section titre="Mon allure selon la pente">
      <View style={[S.carte, { marginTop: 0, gap: 6 }]}>
        {!modele ? (
          <Text style={S.petit}>
            Ajoute des sorties GPX horodatées : l'appli mesure ton allure réelle par tranche de pente (au moins 500 m courus
            dans une tranche) et s'en sert pour prévoir tes temps de course.
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {TRANCHES.map((t) => (
                <View key={t} style={{ width: "18%", minWidth: 58, backgroundColor: modele.connues.includes(t) ? C.monteeClair : C.fond,
                                       borderRadius: 10, padding: 6, alignItems: "center" }}>
                  <Text style={S.petit}>{t > 0 ? "+" : ""}{t} %</Text>
                  <Text style={[S.fort, { fontSize: 14 }]}>{allureLisible(modele.secondesParMetre(t))}</Text>
                </View>
              ))}
            </View>
            <Text style={S.petit}>
              min/km. En couleur : mesuré sur tes sorties ; le reste est estimé (coût énergétique de la pente, Minetti 2002),
              recalé sur toi. {nombre(modele.metres / 1000, 0)} km analysés.
            </Text>
          </>
        )}
      </View>
    </Section>
  );
}

function MesCotes({ cotes, activites, position, onChoisir }: {
  cotes: Cote[]; activites: Activite[]; position: PointDepart["position"]; onChoisir: (c: CoteProche, rang: number) => void;
}) {
  const courues = useMemo(() => {
    const cles = new Set(activites.flatMap((a) => a.repetitions.map((r) => r.cle)).filter(Boolean));
    return cotes.filter((c) => cles.has(cleCote(c)))
      .map((c) => ({ c, passages: mesPassages(activites, c) }))
      .filter((x) => x.passages.length)
      .sort((a, b) => b.passages[0].date.localeCompare(a.passages[0].date));
  }, [cotes, activites]);
  return (
    <Section titre="Mes côtes">
      {courues.length === 0 ? (
        <View style={[S.carte, { marginTop: 0 }]}>
          <Text style={S.petit}>
            Importe le GPX de tes sorties (Profil → Ajouter une sortie) : chaque montée d'une côte de l'appli est chronométrée du
            pied au sommet. Tu retrouveras ici tes records et ta progression, côte par côte, sans Strava.
          </Text>
        </View>
      ) : courues.map(({ c, passages }, i) => {
        const temps = passages.filter((p) => p.temps_s).map((p) => p.temps_s!);
        const record = temps.length ? Math.min(...temps) : null;
        const dernier = passages[0].temps_s;
        return (
          <Pressable key={c.id} onPress={() => onChoisir({ ...c, distance_m: distanceM(position, c) }, i + 1)} accessibilityRole="button"
                     style={[S.ligne, { alignItems: "stretch", paddingLeft: 0, overflow: "hidden" }]}>
            <View style={{ width: 6, backgroundColor: couleurPente(c.pente_moy_pct) }} />
            <View style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
              <Text style={S.fort}>{nombre(Math.round(c.longueur_m / 10) * 10)} m à {nombre(c.pente_moy_pct, 1)} %</Text>
              <Text style={S.petit} numberOfLines={1}>{c.adresse || c.nom || c.type_voie}</Text>
              <Text style={[S.petit, { color: C.encre }]}>
                {passages.length} montée{passages.length > 1 ? "s" : ""}{dernier ? ` · dernière ${chrono(dernier)}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
              <Text style={S.petit}>Record</Text>
              <Text style={[S.fort, { color: C.montee }]}>{record ? chrono(record) : "—"}</Text>
              {record ? <Text style={S.petit}>{nombre(vitesseAscensionnelle(c.dplus_m, record))} m/h</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </Section>
  );
}

export function EcranEntrainement({ mode, setMode, toutes, depart, localisation, onRecherche, onLocaliser, onLieu, zones,
                                    filtres, allurePlat, onChoisir, activites, modele, onAjouterSortie, demandeSeance, demandeSortie }: {
  mode: ModeEntrainement; setMode: (m: ModeEntrainement) => void; toutes: Cote[]; depart: PointDepart;
  localisation: Localisation; onRecherche: () => void; onLocaliser: () => void; onLieu: (l: Lieu) => void; zones: Lieu[];
  filtres: Filtres; allurePlat: number; onChoisir: (c: CoteProche, rang: number) => void; activites: Activite[];
  modele: Modele | null; onAjouterSortie: () => void;
  demandeSeance: { texte: string; n: number } | null; demandeSortie: (PresetSortie & { n: number }) | null;
}) {
  const position = depart.position;
  const couverture = useMemo(() => distanceCouverture(toutes, position), [toutes, position]);
  const horsZone = mode !== "progres" && couverture > RAYON_COUVERTURE_M;
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ marginTop: 4 }}>
        <Segments options={[["seance", "Séance"], ["boucle", "Sortie"], ["progres", "Mes progrès"]]} valeur={mode} onChange={setMode} />
      </View>
      {mode !== "progres" && (
        <View style={{ marginTop: 10 }}>
          <BarreDepart titre={mode === "boucle" ? "Départ et arrivée" : "Séance autour de"} depart={depart} localisation={localisation}
                       onRecherche={onRecherche} onLocaliser={onLocaliser} />
        </View>
      )}
      {horsZone ? (
        <HorsZone depart={depart} distance={couverture} zones={zones} onLieu={onLieu} />
      ) : mode === "seance" ? (
        <VueSeance key={demandeSeance?.n ?? 0} texteInitial={demandeSeance?.texte} toutes={toutes} position={position} filtres={filtres}
                   allurePlat={allurePlat} onChoisir={onChoisir} />
      ) : mode === "boucle" ? (
        <VueBoucle key={demandeSortie?.n ?? 0} preset={demandeSortie ?? undefined} toutes={toutes} position={position}
                   nomDepart={depart.nom} allurePlat={allurePlat} onChoisir={onChoisir} modele={modele} />
      ) : (
        <>
          <Pressable onPress={onAjouterSortie} accessibilityRole="button" style={[S.bouton, { marginTop: 14 }]}>
            <Text style={S.boutonTexte}>Ajouter une sortie GPX</Text>
          </Pressable>
          <MesCotes cotes={toutes} activites={activites} position={position} onChoisir={onChoisir} />
          <MonAllure modele={modele} />
        </>
      )}
    </ScrollView>
  );
}
