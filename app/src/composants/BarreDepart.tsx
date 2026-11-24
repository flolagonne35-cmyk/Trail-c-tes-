// Point de départ commun aux côtes, séances et boucles : lieu choisi ou GPS, et bouton « Me localiser ».

import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { Position } from "../calcul/geo.ts";
import { C, S } from "../theme.ts";
import { Icone } from "./communs.tsx";

// « apercu » : la page tourne dans un cadre (aperçu web, par exemple dans l'appli Claude) qui
// n'a pas le droit de demander la position ; l'appli installée, elle, demande l'autorisation.
export type Localisation = "inactive" | "en_cours" | "refusee" | "indisponible" | "apercu";
export type PointDepart = { position: Position; nom: string; detail: string; gps: boolean };

/**
 * Pas encore de point de départ (retour du 24/11 : « pourquoi c'est toujours marqué Rennes ? ») :
 * on ne suppose plus de ville. Le centre de la France ne sert qu'aux calculs en attendant le choix.
 */
export const DEPART_INCONNU: PointDepart = { position: { lat: 46.6, lon: 2.4 }, nom: "Choisis ton point de départ",
                                             detail: "Ville, code postal, adresse ou ta position", gps: false };
export const estInconnu = (d: PointDepart) => !d.gps && d.nom === DEPART_INCONNU.nom;

export function BarreDepart({ titre, depart, localisation, onRecherche, onLocaliser }: {
  titre: string; depart: PointDepart; localisation: Localisation; onRecherche: () => void; onLocaliser: () => void;
}) {
  const sousTitre = localisation === "en_cours" ? "Localisation en cours…"
    : localisation === "refusee" ? "Position refusée : autorise-la (réglages du navigateur ou du téléphone) ou écris une ville"
    : localisation === "apercu" ? "GPS non disponible dans l'aperçu : cherche une ville"
    : localisation === "indisponible" ? "Position indisponible : cherche une ville"
    : depart.detail;
  const inconnu = estInconnu(depart);
  return (
    <View>
      <Text style={[S.surtitre, { marginTop: 8 }]}>{titre}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        <Pressable onPress={onRecherche} accessibilityRole="search" accessibilityLabel={`Point de départ : ${depart.nom}. Changer`}
                   style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.blanc,
                            borderRadius: 16, paddingHorizontal: 14, minHeight: 56, borderWidth: 2, borderColor: inconnu ? C.montee : "transparent" }}>
          <Icone nom="recherche" couleur={C.gris} taille={20} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: inconnu ? C.monteeFonce : C.encre }} numberOfLines={1}>{depart.nom}</Text>
            <Text style={S.petit} numberOfLines={1}>{sousTitre}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onLocaliser} accessibilityRole="button" accessibilityLabel="Me localiser"
                   style={{ width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center",
                            backgroundColor: depart.gps ? C.montee : C.encre }}>
          {localisation === "en_cours" ? <ActivityIndicator color={C.fond} /> : <Icone nom="position" couleur={C.fond} />}
        </Pressable>
      </View>
    </View>
  );
}
