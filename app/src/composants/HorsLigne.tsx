// Hors connexion. Version web (PWA) : « Garder cette zone » met côtes, réseau des boucles, points
// d'eau et carte de la zone dans le navigateur (src/zoneHorsLigne.ts). Téléphone (appli native) :
// « Carte hors ligne » télécharge les tuiles Plan IGN autour du départ (5 km, zooms 11 à 16).

import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { Position } from "../calcul/geo.ts";
import { BOUCLE_MAX_KM, RAYON_COTES_KM, tailleLisible } from "../calcul/horsLigne.ts";
import { HORS_LIGNE_POSSIBLE, nombreTuiles, telechargerZone } from "../cartesHorsLigne.ts";
import { C, S } from "../theme.ts";
import { garderZone, oublierZones, ZONE_WEB_POSSIBLE, zonesGardees, type ZoneGardee } from "../zoneHorsLigne.ts";

/** Version web : garder la zone du départ (côtes, boucles, points d'eau, carte) pour courir sans réseau. */
function ZoneHorsLigne({ centre, nom }: { centre: Position; nom: string }) {
  const [etat, setEtat] = useState<{ faites: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gardees, setGardees] = useState<ZoneGardee[]>(zonesGardees);
  const annule = useRef(false);
  const lancer = async () => {
    annule.current = false;
    setMessage(null);
    setEtat({ faites: 0, total: 1 });
    const r = await garderZone(centre, nom, (faites, total) => setEtat({ faites, total }), () => annule.current);
    setEtat(null);
    setGardees(zonesGardees());
    setMessage(annule.current ? "Arrêté : relance pour finir (ce qui est fait est gardé)."
      : r.echecs ? `${r.echecs} fichiers de données non gardés (réseau ?) : relance pour finir.`
        : `${nom} est gardé sur ce téléphone (${tailleLisible(r.octets)}) : côtes, boucles et points d'eau marchent sans réseau`
          + (r.echecsCarte ? `, mais ${r.echecsCarte} morceaux de carte n'ont pas pu être gardés (relance pour réessayer).` : ", carte comprise."));
  };
  const effacer = async () => { await oublierZones(); setGardees([]); setMessage("Zones effacées du téléphone."); };
  return (
    <View style={[S.carte, { marginTop: 10, gap: 8 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={S.fort}>Garder cette zone hors connexion</Text>
          <Text style={S.petit}>
            {etat ? `${Math.round((100 * etat.faites) / etat.total)} % (${etat.faites} / ${etat.total} fichiers)`
              : message ?? `Autour de ${nom} : côtes à ${RAYON_COTES_KM} km, boucles jusqu'à ${BOUCLE_MAX_KM} km, points d'eau et carte détaillée à 5 km. Quelques dizaines de Mo, à faire en wifi.`}
          </Text>
        </View>
        <Pressable onPress={etat ? () => { annule.current = true; } : lancer} accessibilityRole="button"
                   style={[etat ? S.boutonClair : S.bouton, { minHeight: 40 }]}>
          <Text style={etat ? S.boutonClairTexte : S.boutonTexte}>{etat ? "Arrêter" : "Garder"}</Text>
        </Pressable>
      </View>
      {gardees.length > 0 && !etat && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={[S.petit, { flex: 1 }]}>
            Gardé : {gardees.map((z) => `${z.nom} (${tailleLisible(z.octets)})`).join(", ")}. Les zones où tu as déjà cherché restent aussi, en partie.
          </Text>
          <Pressable onPress={effacer} accessibilityRole="button" style={[S.boutonClair, { minHeight: 40 }]}>
            <Text style={[S.boutonClairTexte, { color: C.monteeFonce }]}>Effacer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const RAYON_M = 5000;
const KO_PAR_TUILE = 55; // moyenne mesurée sur les tuiles Plan IGN de Rennes (zooms 11 à 15)

export function CarteHorsLigne({ centre, nom }: { centre: Position; nom: string }) {
  const [etat, setEtat] = useState<{ faites: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const annule = useRef(false);
  const total = nombreTuiles(centre, RAYON_M);
  if (ZONE_WEB_POSSIBLE) return <ZoneHorsLigne centre={centre} nom={nom} />;
  if (!HORS_LIGNE_POSSIBLE) return null;
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
