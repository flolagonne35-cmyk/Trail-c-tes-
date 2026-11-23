// Courses → une course : tout ce qu'il faut pour décider et s'inscrire sans charge mentale.
// La course (date, lieu, formats, notoriété), l'inscription (prix et dates quand l'organisateur les
// publie, lien officiel), « Préparer ce format » (programme et jour J), puis y aller et dormir.

import { Linking, Pressable, Text, View } from "react-native";

import type { CourseProche } from "../calcul/agenda.ts";
import { kmLisibles } from "../calcul/cotes.ts";
import type { CourseCible } from "../calcul/plan.ts";
import type { PointDepart } from "../composants/BarreDepart.tsx";
import { nombre } from "../composants/communs.tsx";
import { C, S } from "../theme.ts";
import { VueVoyage } from "./Voyage.tsx";
import { CheckList } from "../composants/CheckList.tsx";

const jourLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const euros = (v: number) => `${nombre(v, v % 1 ? 2 : 0)} €`;

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 36 }}>
      <Text style={S.h2} accessibilityRole="header">{titre}</Text>
      <View style={[S.carte, { marginTop: 12, gap: 14 }]}>{children}</View>
    </View>
  );
}

export function EcranFicheComplete({ course: c, depart, deja, onRetour, onAjouter, onPreparer }: {
  course: CourseProche; depart: PointDepart; deja: boolean; onRetour: () => void; onAjouter: () => void;
  onPreparer: (cible: CourseCible) => void;
}) {
  const ici = depart.gps ? "toi" : depart.nom.split(",")[0];
  const preparer = (km: number | null) => onPreparer({
    nom: c.distances_km.length > 1 && km ? `${c.nom} (${String(km).replace(".", ",")} km)` : c.nom,
    distance_km: km ?? c.distances_km.at(-1) ?? 10, dplus_m: c.dplus_m ?? 0, date: c.date, site: c.site || undefined,
  });
  const entete = (
    <View>
      <Pressable onPress={onRetour} accessibilityRole="button" hitSlop={10} style={{ marginTop: 4, minHeight: 40, justifyContent: "center" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.montee }}>← Toutes les courses</Text>
      </Pressable>
      <View style={{ backgroundColor: C.foret, borderRadius: 26, padding: 24, marginTop: 8, gap: 8 }}>
        <Text style={{ color: "#F6F4EFCC", fontSize: 15, fontWeight: "700", textTransform: "capitalize" }}>{jourLong(c.date)}</Text>
        <Text style={{ color: C.fond, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.5 }} accessibilityRole="header">{c.nom}</Text>
        <Text style={{ color: "#F6F4EFCC", fontSize: 16 }}>{c.commune}{c.cp ? ` (${c.cp.slice(0, 2)})` : ""} · {kmLisibles(c.distance_m)} de {ici}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          <Text style={{ color: C.foret, backgroundColor: C.fond, fontWeight: "800", fontSize: 13, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
            {c.type === "trail" ? "Trail" : "Route"}
          </Text>
          {!!c.connue && (
            <Text style={{ color: "#5C4600", backgroundColor: "#FBF0C9", fontWeight: "800", fontSize: 13, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>
              ★ {c.connue >= 10 ? "Renommée internationale" : "Course connue"}
            </Text>
          )}
          {c.complet && (
            <Text style={{ color: C.blanc, backgroundColor: C.montee, fontWeight: "800", fontSize: 13, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>Complet</Text>
          )}
        </View>
      </View>

      <Bloc titre="Ma check-list">
        <CheckList idCourse={c.id} site={c.site || undefined} nuit={c.distance_m > 80000} />
      </Bloc>

      <Bloc titre="Les formats">
        {c.distances_km.length ? c.distances_km.map((km) => (
          <View key={km} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>{String(km).replace(".", ",")} km</Text>
              {c.dplus_m && km === c.distances_km.at(-1) ? <Text style={S.petit}>{nombre(c.dplus_m)} m de dénivelé positif</Text> : null}
            </View>
            <Pressable onPress={() => preparer(km)} accessibilityRole="button" accessibilityLabel={`Préparer le ${km} km`}
                       style={[S.bouton, { minHeight: 46, paddingHorizontal: 16 }]}>
              <Text style={[S.boutonTexte, { fontSize: 15 }]}>Préparer</Text>
            </Pressable>
          </View>
        )) : (
          <>
            <Text style={S.texte}>Les formats ne sont pas précisés dans l'annonce : regarde le site officiel, puis prépare-la avec la distance choisie.</Text>
            <Pressable onPress={() => preparer(null)} accessibilityRole="button" style={S.bouton}>
              <Text style={S.boutonTexte}>Préparer cette course</Text>
            </Pressable>
          </>
        )}
        <Text style={S.petit}>« Préparer » crée ton programme jusqu'au jour J et ta feuille de course.</Text>
      </Bloc>

      <Bloc titre="Inscription et prix">
        {c.prix_eur?.length ? (
          <Text style={S.fort}>Dossard : {c.prix_eur.length > 1 ? `de ${euros(c.prix_eur[0])} à ${euros(c.prix_eur.at(-1)!)}` : euros(c.prix_eur[0])}</Text>
        ) : <Text style={S.fort}>Prix du dossard : pas encore publié</Text>}
        {c.inscription ? <Text style={S.texte}>« {c.inscription} »</Text> : (
          <Text style={S.texte}>Dates d'inscription pas encore annoncées. Les inscriptions ouvrent souvent 3 à 6 mois avant la course (plus tôt pour les grands trails).</Text>
        )}
        {c.complet && <Text style={[S.fort, { color: C.monteeFonce }]}>L'annonce indique que la course est complète : vérifie s'il existe une liste d'attente.</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {!!c.site && (
            <Pressable onPress={() => Linking.openURL(c.site).catch(() => undefined)} accessibilityRole="link" style={[S.bouton, { flexGrow: 1 }]}>
              <Text style={S.boutonTexte}>S'inscrire sur le site officiel ↗</Text>
            </Pressable>
          )}
          <Pressable onPress={onAjouter} disabled={deja} accessibilityRole="button" aria-disabled={deja}
                     style={[S.boutonClair, { flexGrow: 1, opacity: deja ? 0.6 : 1 }]}>
            <Text style={S.boutonClairTexte}>{deja ? "Dans mes courses ✓" : "Ajouter à mes courses"}</Text>
          </Pressable>
        </View>
        <Text style={S.petit}>
          Prix et dates lus dans l'annonce de l'organisateur{c.maj ? ` (mise à jour le ${new Date(c.maj).toLocaleDateString("fr-FR")})` : ""} : le site officiel fait foi.
          Source : {c.auteur ? `${c.auteur}, via ` : ""}{c.source}.
        </Text>
      </Bloc>
    </View>
  );
  return <VueVoyage course={c} depart={depart} onRetour={onRetour} entete={entete} />;
}
