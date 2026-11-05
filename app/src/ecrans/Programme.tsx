// Programme → « Mon programme » : la course objectif, le questionnaire, puis le plan semaine par
// semaine. Chaque séance du plan ouvre l'endroit où la faire (Programme → Sorties ou Séance).

import { useState } from "react";
import { ScrollView, Text } from "react-native";

import type { Modele } from "../calcul/allure.ts";
import type { CourseInscrite } from "../calcul/calendrier.ts";
import type { CourseCible, Questionnaire } from "../calcul/plan.ts";
import type { Parcours } from "../calcul/profil.ts";
import { S } from "../theme.ts";
import { EtatImport, useImport } from "./Course.tsx";
import { ChoixCourse, EnTeteCourse, FormulaireQuestionnaire, VuePlan, type PresetSortie } from "./Plan.tsx";

export function EcranProgramme({ cible, setCible, questionnaire, setQuestionnaire, parcours, onParcours, onExemple, mesCourses,
                                 modele, allurePlat, onSeance, onSortie }: {
  cible: CourseCible | null; setCible: (c: CourseCible | null) => void;
  questionnaire: Questionnaire | null; setQuestionnaire: (q: Questionnaire | null) => void;
  parcours: Parcours | null; onParcours: (p: Parcours | null) => void; onExemple: () => void; mesCourses: CourseInscrite[];
  modele: Modele | null; allurePlat: number; onSeance: (texte: string) => void; onSortie: (p: PresetSortie) => void;
}) {
  const [edition, setEdition] = useState(false);
  const { etat, erreur, importer } = useImport((p) => onParcours(p));
  const course: CourseCible | null = cible
    ?? (parcours ? { nom: parcours.nom, distance_km: Math.round(parcours.distance_km * 10) / 10, dplus_m: Math.round(parcours.dplus_m) } : null);
  const etatImport = <EtatImport etat={etat} erreur={erreur} />;
  if (!course) {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
        <Text style={[S.petit, { fontSize: 15, lineHeight: 22, color: "#1B2A22" }]}>
          Ton programme se construit autour de ta course objectif : choisis-la, réponds à quelques questions, et l'appli te
          prépare chaque semaine, séance par séance, avec l'endroit où la faire autour de toi.
        </Text>
        <ChoixCourse mesCourses={mesCourses} onChoisir={(c) => setCible(c)} onImporter={importer} onExemple={onExemple}
                     etatImport={etatImport} />
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
