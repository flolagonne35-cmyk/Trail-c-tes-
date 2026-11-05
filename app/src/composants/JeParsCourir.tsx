// « Je pars courir » : prévenir un proche (heure de retour, point de départ) et partager sa position
// en direct. Proposé au moment de partir, sous la boucle choisie (Programme → Sorties).

import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { messageDepart } from "../calcul/jour.ts";
import { partagerTexte } from "../fichiers.ts";
import { C, S } from "../theme.ts";
import type { PointDepart } from "./BarreDepart.tsx";
import { Icone, Segments } from "./communs.tsx";

const DUREES: [string, string][] = [["45", "45 min"], ["60", "1 h"], ["90", "1 h 30"], ["120", "2 h"], ["180", "3 h"]];

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={[S.carte, { gap: 10, padding: 16 }]}>
      <Text style={[S.surtitre, { fontSize: 12 }]} accessibilityRole="header">{titre}</Text>
      {children}
    </View>
  );
}

/** « Je pars courir » : un message pour un proche (heure de retour, point de départ), envoyé par moi. */
// Position en direct, écran verrouillé : les applis faites pour (WhatsApp, Localiser, montres) le font
// de façon fiable et économe ; une page web (PWA) ne peut pas suivre le GPS écran éteint.
type Suivi = "whatsapp" | "iphone" | "montre";
const SUIVIS: [Suivi, string][] = [["whatsapp", "WhatsApp"], ["iphone", "iPhone"], ["montre", "Montre"]];
const ETAPES: Record<Suivi, string> = {
  whatsapp: "Le message s'ouvre dans WhatsApp : choisis le proche, envoie, puis dans la conversation touche ＋ (ou 📎) → Position → Partager la position en direct → 1 heure (ou 8 heures pour une longue sortie).",
  iphone: "Envoie d'abord le message, puis dans Localiser : Moi → Partager ma position → choisis le proche → Partager pendant une heure (ou jusqu'à la fin de la journée).",
  montre: "Garmin : dans Garmin Connect, menu → Sécurité et suivi → LiveTrack, puis lance l'activité sur la montre : tes contacts reçoivent le lien. Strava : Beacon dans l'écran d'enregistrement (abonnement). Coros, Suunto : suivi en direct dans leur appli.",
};

function ouvrir(url: string, repli?: string) {
  Linking.openURL(url).catch(() => (repli ? Linking.openURL(repli).catch(() => undefined) : undefined));
}

/** « Je pars courir » : message pour un proche (heure de retour, point de départ) et position en direct. */
export function JeParsCourir({ depart }: { depart: PointDepart }) {
  const [duree, setDuree] = useState("60");
  const [suivi, setSuivi] = useState<Suivi>("whatsapp");
  const message = () => messageDepart(Number(duree), { nom: depart.nom, ...depart.position, gps: depart.gps });
  return (
    <Carte titre="Sécurité">
      <Text style={S.fort}>Je pars courir</Text>
      <Text style={S.petit}>
        Préviens un proche : heure de départ, retour prévu et point de départ ({depart.gps ? "ta position" : depart.nom}).
        Rien n'est envoyé sans toi : tu choisis le contact dans le message.
      </Text>
      <Text style={[S.fort, { fontWeight: "600" }]}>Durée prévue</Text>
      <Segments options={DUREES} valeur={duree} onChange={setDuree} />
      <Pressable onPress={() => partagerTexte("Je pars courir", message())}
                 accessibilityRole="button" style={[S.bouton, { flexDirection: "row", gap: 8 }]}>
        <Icone nom="position" couleur={C.fond} taille={18} />
        <Text style={S.boutonTexte}>Prévenir un proche</Text>
      </Pressable>

      <View style={{ gap: 8, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.aire }}>
        <Text style={S.fort}>Me suivre en direct</Text>
        <Text style={S.petit}>Pour que ton proche voie où tu es pendant la sortie, même écran verrouillé :</Text>
        <Segments options={SUIVIS} valeur={suivi} onChange={setSuivi} />
        <Text style={[S.petit, { color: C.encre, fontSize: 14, lineHeight: 20 }]}>{ETAPES[suivi]}</Text>
        {suivi === "whatsapp" && (
          <Pressable onPress={() => ouvrir(`https://wa.me/?text=${encodeURIComponent(message())}`)} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Envoyer par WhatsApp</Text>
          </Pressable>
        )}
        {suivi === "iphone" && (
          <Pressable onPress={() => ouvrir("findmy://")} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Ouvrir Localiser</Text>
          </Pressable>
        )}
        {suivi === "montre" && (
          <Pressable onPress={() => ouvrir("strava://", "https://www.strava.com")} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Ouvrir Strava</Text>
          </Pressable>
        )}
      </View>
    </Carte>
  );
}

