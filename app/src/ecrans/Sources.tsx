// « Données et confidentialité » : d'où viennent les chiffres de l'appli, et ce qui reste sur le téléphone.

import { ScrollView, Text, View } from "react-native";

import { Section } from "../composants/communs.tsx";
import { S } from "../theme.ts";

const SOURCES: [string, string][] = [
  ["Altitudes", "IGN RGE ALTI (modèle numérique de terrain au mètre), lissé avant le calcul des pentes. Les ponts et tunnels sont exclus : le terrain n'y est pas la voie."],
  ["Voies et trafic", "IGN BD TOPO : routes, chemins, sentiers, accès piéton, importance, vitesse et nombre de voies (pour signaler les routes passantes)."],
  ["Carte", "Plan IGN v2 (Géoplateforme)."],
  ["Adresses et itinéraires", "Géocodage IGN (Base Adresse Nationale) et calcul d'itinéraire IGN (voiture, piéton)."],
  ["Communes", "geo.api.gouv.fr : les 35 000 communes, cherchables sans réseau."],
  ["Revêtement", "© contributeurs OpenStreetMap (ODbL), quand la BD TOPO ne le précise pas."],
  ["Effort selon la pente", "Minetti et al. 2002 (coût énergétique de la course), recalé sur tes sorties ; km-effort de l'ITRA (100 m de D+ ≈ 1 km)."],
  ["Nutrition", "ACSM / Thomas et al. 2016, Jeukendrup 2014 (glucides) ; ISSN, Tiller et al. 2019 (eau et sodium en ultra)."],
];

export function EcranSources() {
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Section titre="D'où viennent les chiffres">
        <View style={[S.carte, { marginTop: 0, gap: 12 }]}>
          {SOURCES.map(([t, d]) => (
            <View key={t} style={{ gap: 2 }}>
              <Text style={S.fort}>{t}</Text>
              <Text style={[S.petit, { fontSize: 13, lineHeight: 18 }]}>{d}</Text>
            </View>
          ))}
          <Text style={S.petit}>Données IGN et geo.api.gouv.fr sous Licence Ouverte (Etalab 2.0).</Text>
        </View>
      </Section>
      <Section titre="Ce qui reste sur ton téléphone">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          <Text style={[S.petit, { fontSize: 13, lineHeight: 18 }]}>
            Ton profil, ton avatar, tes sorties GPX (trace, fréquence cardiaque), tes captures, tes courses et tes réglages restent
            sur ton téléphone : rien n'est envoyé à un serveur Trail-côtes, il n'y a ni publicité ni traceur.
          </Text>
          <Text style={[S.petit, { fontSize: 13, lineHeight: 18 }]}>
            Sont envoyés aux services publics de l'IGN, sans identifiant : le texte d'une adresse cherchée, la position de départ
            pour calculer un trajet, la zone de carte affichée, les points d'un parcours importé (pour ses altitudes). Les boucles,
            séances, la recherche de ville et la nutrition se calculent sur le téléphone.
          </Text>
          <Text style={[S.petit, { fontSize: 13, lineHeight: 18 }]}>
            La position n'est demandée que quand l'appli est ouverte ; sans elle, cherche une ville ou une adresse.
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}
