// « Sécurité » : tout ce qui sert à partir l'esprit tranquille, au même endroit. Prévenir un proche
// (heure de retour, position en direct), retrouver son point de départ sans réseau, et savoir à
// quelle heure tombe la nuit. Accessible depuis l'accueil et depuis les parcours.

import { Pressable, ScrollView, Text } from "react-native";

import type { PointDepart } from "../composants/BarreDepart.tsx";
import { JeParsCourir } from "../composants/JeParsCourir.tsx";
import { RetourDepart } from "../composants/RetourDepart.tsx";
import { C, S } from "../theme.ts";
import { Lumiere } from "./Accueil.tsx";

export function EcranSecurite({ depart, onRetour }: { depart: PointDepart; onRetour: () => void }) {
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Pressable onPress={onRetour} accessibilityRole="button" hitSlop={10} style={{ minHeight: 40, justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.montee }}>← Retour</Text>
      </Pressable>
      <Text style={S.titre} accessibilityRole="header">Partir l'esprit tranquille</Text>
      <Text style={S.sousTitre}>Avant une sortie seul, surtout en trail ou à la nuit tombante : prends trente secondes.</Text>
      <JeParsCourir depart={depart} />
      <RetourDepart depart={depart.position} nomDepart={depart.nom} />
      <Lumiere position={depart.position} />
    </ScrollView>
  );
}
