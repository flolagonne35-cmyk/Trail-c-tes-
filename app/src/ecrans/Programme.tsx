// Programme → « Mon programme » : la course objectif, le questionnaire, puis le plan semaine par
// semaine. Chaque séance du plan ouvre l'endroit où la faire (Programme → Parcours ou Séance).

import { useState } from "react";
import { ScrollView } from "react-native";

import type { Modele } from "../calcul/allure.ts";
import type { CourseCible, Questionnaire } from "../calcul/plan.ts";
import type { Parcours } from "../calcul/profil.ts";
import { SansCourse } from "../composants/SansCourse.tsx";
import { S } from "../theme.ts";
import { EtatImport, useImport } from "./Course.tsx";
import { EnTeteCourse, FormulaireQuestionnaire, VuePlan, type PresetSortie } from "./Plan.tsx";

export function EcranProgramme({ cible, setCible, questionnaire, setQuestionnaire, parcours, onParcours, modele, allurePlat,
                                 onSeance, onSortie, onTrouver }: {
  cible: CourseCible | null; setCible: (c: CourseCible | null) => void;
  questionnaire: Questionnaire | null; setQuestionnaire: (q: Questionnaire | null) => void;
  parcours: Parcours | null; onParcours: (p: Parcours | null) => void; onTrouver: () => void;
  modele: Modele | null; allurePlat: number; onSeance: (texte: string) => void; onSortie: (p: PresetSortie) => void;
}) {
  const [edition, setEdition] = useState(false);
  const { etat, erreur } = useImport((p) => onParcours(p));
  const course: CourseCible | null = cible
    ?? (parcours ? { nom: parcours.nom, distance_km: Math.round(parcours.distance_km * 10) / 10, dplus_m: Math.round(parcours.dplus_m) } : null);
  const etatImport = <EtatImport etat={etat} erreur={erreur} />;
  if (!course) {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <SansCourse titre="D'abord, ta course" onTrouver={onTrouver}
                    texte="Ton programme se construit autour d'elle : choisis-la, réponds à quelques questions, et chaque semaine tu sais quoi faire et où." />
        {etatImport}
      </ScrollView>
    );
  }
  const allureMinKm = modele ? (modele.secondesParMetre(0) * 1000) / 60 : allurePlat;
  const changer = () => { setCible(null); onParcours(null); setQuestionnaire(null); };
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <EnTeteCourse course={course} onChanger={changer} />
      {etatImport}
      {questionnaire && !edition ? (
        <VuePlan course={course} questionnaire={questionnaire} allureMinKm={allureMinKm} onModifier={() => setEdition(true)}
                 onSeance={onSeance} onSortie={onSortie} />
      ) : (
        <FormulaireQuestionnaire initial={questionnaire} course={course}
                                 onValider={(q, date) => { setQuestionnaire(q); if (date) setCible({ ...course, date }); setEdition(false); }} />
      )}
    </ScrollView>
  );
}
