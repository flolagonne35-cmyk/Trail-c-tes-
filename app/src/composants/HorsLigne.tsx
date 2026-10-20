// « Carte hors ligne » : télécharge les tuiles Plan IGN autour du point de départ (5 km, zooms 11 à 16).

import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Position } from "../calcul/geo.ts";
import { HORS_LIGNE_POSSIBLE, nombreTuiles, telechargerZone } from "../cartesHorsLigne.ts";
import { S } from "../theme.ts";

const RAYON_M = 5000;
const KO_PAR_TUILE = 55; // moyenne mesurée sur les tuiles Plan IGN de Rennes (zooms 11 à 15)

export function CarteHorsLigne({ centre, nom }: { centre: Position; nom: string }) {
  const [etat, setEtat] = useState<{ faites: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const annule = useRef(false);
  const total = nombreTuiles(centre, RAYON_M);
  if (!HORS_LIGNE_POSSIBLE) {
    return <Text style={[S.petit, { marginTop: 8 }]}>Sur le téléphone : « Carte hors ligne » garde la carte de la zone pour courir sans réseau.</Text>;
  }
  const lancer = async () => {
    annule.current = false;
    setMessage(null);
    setEtat({ faites: 0, total });
    const echecs = await telechargerZone(centre, RAYON_M, (faites, t) => setEtat({ faites, total: t }), () => annule.current);
    setEtat(null);
    setMessage(annule.current ? "Téléchargement arrêté ; relance pour finir."
      : echecs ? `${echecs} morceaux de carte non téléchargés (réseau ?) : relance pour finir.` : `Carte de ${nom} disponible sans réseau.`);
  };
  return (
    <View style={[S.ligne, { marginTop: 10, paddingVertical: 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={S.fort}>Carte hors ligne</Text>
        <Text style={S.petit}>
          {etat ? `${Math.round((100 * etat.faites) / etat.total)} % (${etat.faites} / ${etat.total})`
            : message ?? `5 km autour de ${nom}, ≈ ${Math.round((total * KO_PAR_TUILE) / 1024)} Mo`}
        </Text>
      </View>
      <Pressable onPress={etat ? () => { annule.current = true; } : lancer} accessibilityRole="button"
                 style={[etat ? S.boutonClair : S.bouton, { minHeight: 40 }]}>
        <Text style={etat ? S.boutonClairTexte : S.boutonTexte}>{etat ? "Arrêter" : "Télécharger"}</Text>
      </Pressable>
    </View>
  );
}
