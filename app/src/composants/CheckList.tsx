// « Ma check-list » d'une course : tout ce qu'il faut faire entre « je m'inscris » et la ligne de
// départ, coché au fur et à mesure (gardé sur le téléphone, par course).
//
// Certificat ou PPS : depuis 2025, pour une course à pied inscrite au calendrier de la Fédération
// française d'athlétisme, un coureur sans licence remplit le « Parcours prévention santé » (PPS) en
// ligne sur pps.athle.fr à la place du certificat médical (valable 3 mois). Le règlement de chaque
// course fait foi (trails à l'étranger, courses hors FFA).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { C, S } from "../theme.ts";

type Etape = { id: string; titre: string; detail: string; lien?: [string, string] };

export function etapes(site: string | undefined, nuit: boolean): Etape[] {
  return [
    { id: "inscription", titre: "M'inscrire", detail: "Sur le site officiel : garde l'e-mail de confirmation.", lien: site ? ["Site officiel", site] : undefined },
    { id: "sante", titre: "Licence, PPS ou certificat", detail: "Sans licence FFA : le Parcours prévention santé en ligne, valable 3 mois. Vérifie le règlement.",
      lien: ["pps.athle.fr", "https://pps.athle.fr"] },
    { id: "plan", titre: "Créer mon plan", detail: "Le programme jusqu'au jour J, dans « Mon plan »." },
    { id: "transport", titre: "Organiser le trajet", detail: "Voiture, covoiturage ou train : voir « Y aller » plus bas." },
    ...(nuit ? [{ id: "logement", titre: "Réserver le logement", detail: "La veille, près du départ : voir « Dormir sur place »." }] : []),
    { id: "materiel", titre: "Vérifier le matériel obligatoire", detail: "Liste du règlement, et ton sac dans « Jour J »." },
    { id: "dossard", titre: "Retrait du dossard", detail: "Horaires et pièces à apporter (pièce d'identité, PPS) : sur le site officiel." },
  ];
}

export function CheckList({ idCourse, site, nuit }: { idCourse: string; site?: string; nuit: boolean }) {
  const cle = `trailcotes.checklist.${idCourse}`;
  const [faits, setFaits] = useState<string[]>([]);
  useEffect(() => { AsyncStorage.getItem(cle).then((v) => setFaits(v ? JSON.parse(v) : [])).catch(() => undefined); }, [cle]);
  const basculer = (id: string) => {
    const n = faits.includes(id) ? faits.filter((x) => x !== id) : [...faits, id];
    setFaits(n);
    AsyncStorage.setItem(cle, JSON.stringify(n)).catch(() => undefined);
  };
  const liste = etapes(site, nuit);
  return (
    <View style={{ gap: 4 }}>
      <Text style={[S.petit, { marginBottom: 6 }]}>{faits.filter((f) => liste.some((e) => e.id === f)).length} sur {liste.length} fait</Text>
      {liste.map((e) => {
        const fait = faits.includes(e.id);
        return (
          <View key={e.id} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.aire }}>
            <Pressable onPress={() => basculer(e.id)} accessibilityRole="checkbox" aria-checked={fait} accessibilityLabel={e.titre} hitSlop={8}
                       style={{ width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: fait ? C.descente : C.sable,
                                backgroundColor: fait ? C.descente : C.blanc, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              {fait && <Text style={{ color: C.blanc, fontWeight: "900" }}>✓</Text>}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[S.fort, { textDecorationLine: fait ? "line-through" : "none", color: fait ? C.gris : C.encre }]}>{e.titre}</Text>
              <Text style={S.petit}>{e.detail}</Text>
              {e.lien && (
                <Pressable onPress={() => Linking.openURL(e.lien![1]).catch(() => undefined)} accessibilityRole="link" hitSlop={6}>
                  <Text style={{ color: C.montee, fontWeight: "800", marginTop: 2 }}>{e.lien[0]} ↗</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
