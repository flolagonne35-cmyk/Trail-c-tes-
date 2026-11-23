// Mon monde → « Progression » : un tableau de bord de sportif, sobre. Le niveau et son anneau de
// progression, les chiffres de la saison, les défis, les médailles à collectionner (de commun à
// légendaire) et l'équipement de marques inventées pour l'appli, à acheter avec ses points ou à
// mériter. Animé avec retenue : l'anneau et les barres se remplissent à l'ouverture.

import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { badges, defis, EQUIPEMENT, palier, PALIERS, RARETES, saison, solde, type Badge, type Defi, type Objet } from "../calcul/monde.ts";
import { score } from "../calcul/points.ts";
import { nombre } from "../composants/communs.tsx";
import type { Profil } from "../profil.ts";
import { C, OMBRE, S } from "../theme.ts";

const CercleAnime = Animated.createAnimatedComponent(Circle);

/** Valeur qui monte de 0 à `cible` à l'ouverture de l'écran. */
function useMontee(cible: number, duree = 1200) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: cible, duration: duree, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, cible, duree]);
  return v;
}

/** Anneau de progression vers le niveau suivant. */
function Anneau({ part, niveau }: { part: number; niveau: number }) {
  const r = 46;
  const tour = 2 * Math.PI * r;
  const v = useMontee(part);
  return (
    <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center" }}>
      <Svg width={120} height={120} viewBox="0 0 120 120" style={{ position: "absolute" }}>
        <Circle cx={60} cy={60} r={r} stroke="rgba(255,255,255,0.14)" strokeWidth={10} fill="none" />
        <CercleAnime cx={60} cy={60} r={r} stroke={C.montee} strokeWidth={10} fill="none" strokeLinecap="round"
                     strokeDasharray={`${tour} ${tour}`} rotation={-90} origin="60, 60"
                     strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [tour, 0] })} />
      </Svg>
      <Text style={{ color: "#F6F4EFB3", fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>NIVEAU</Text>
      <Text style={{ color: C.fond, fontSize: 36, fontWeight: "900", lineHeight: 40 }}>{niveau}</Text>
    </View>
  );
}

function Barre({ part }: { part: number }) {
  const v = useMontee(Math.min(1, part), 900);
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: C.aire, overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", borderRadius: 5, backgroundColor: part >= 1 ? C.descente : C.montee,
                              width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

function LigneDefi({ d }: { d: Defi }) {
  const fait = d.valeur >= d.cible;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={[S.fort, { flex: 1 }]}>{d.titre}</Text>
        <Text style={[S.petit, { color: fait ? C.descenteFonce : C.encre, fontWeight: "700" }]}>
          {fait ? "Réussi" : `${nombre(Math.min(d.valeur, d.cible))} / ${nombre(d.cible)} ${d.unite}`}
        </Text>
      </View>
      <Barre part={d.valeur / d.cible} />
    </View>
  );
}

/** Médaille : disque à la couleur de sa rareté, anneau d'avancement tant qu'elle n'est pas obtenue. */
function Medaille({ b }: { b: Badge }) {
  const r = RARETES[b.rarete];
  const tour = 2 * Math.PI * 26;
  return (
    <View style={{ width: 104, alignItems: "center", gap: 8 }} accessible
          accessibilityLabel={`${b.nom}, ${r.nom}, ${b.obtenu ? "obtenue" : `${Math.round(b.avancement * 100)} %`} : ${b.detail}`}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx={32} cy={32} r={26} fill={b.obtenu ? r.couleur : C.aire} />
        {!b.obtenu && (
          <Circle cx={32} cy={32} r={26} fill="none" stroke={r.couleur} strokeWidth={4} strokeLinecap="round"
                  strokeDasharray={`${tour * b.avancement} ${tour}`} rotation={-90} origin="32, 32" />
        )}
        <Path d="M32 18 L36 28 L47 28 L38 35 L41 46 L32 39 L23 46 L26 35 L17 28 L28 28 Z" fill={b.obtenu ? C.blanc : "#C9C3B6"} />
      </Svg>
      <Text style={{ fontSize: 13, fontWeight: "800", color: C.encre, textAlign: "center" }} numberOfLines={2}>{b.nom}</Text>
      <Text style={{ fontSize: 12, fontWeight: "700", color: b.obtenu ? r.couleur : C.gris }}>
        {b.obtenu ? r.nom : `${Math.round(b.avancement * 100)} %`}
      </Text>
    </View>
  );
}

function Section({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 40, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={S.h2} accessibilityRole="header">{titre}</Text>
        {sous ? <Text style={S.petit}>{sous}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function LigneObjet({ o, possede, reste, merite, onAcheter }: { o: Objet; possede: boolean; reste: number; merite: boolean; onAcheter: () => void }) {
  const r = RARETES[o.rarete];
  const assez = o.prix !== undefined && reste >= o.prix;
  return (
    <View style={[S.ligne, { gap: 16 }]}>
      <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: r.couleur }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 1, color: C.gris, textTransform: "uppercase" }}>{o.marque}</Text>
        <Text style={S.fort}>{o.nom}</Text>
        <Text style={S.petit}>{o.detail} · <Text style={{ color: r.couleur, fontWeight: "800" }}>{r.nom}</Text></Text>
      </View>
      {possede || (o.merite && merite) ? (
        <Text style={{ fontWeight: "800", color: C.descenteFonce }}>À toi</Text>
      ) : o.merite ? (
        <Text style={[S.petit, { maxWidth: 96, textAlign: "right" }]}>À mériter</Text>
      ) : (
        <Pressable onPress={onAcheter} disabled={!assez} accessibilityRole="button" aria-disabled={!assez}
                   accessibilityLabel={`Acheter ${o.nom} pour ${o.prix} points`}
                   style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: "center",
                            backgroundColor: assez ? C.encre : C.sable }}>
          <Text style={{ fontWeight: "800", color: assez ? C.fond : C.gris }}>{nombre(o.prix!)} pts</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EcranAventure({ profil, setProfil, onAjouterSortie }: {
  profil: Profil; setProfil: (p: Profil) => void; onAjouterSortie: () => void;
}) {
  const gagnes = score(profil.activites).valides;
  const achats = profil.achats ?? [];
  const reste = solde(gagnes, achats);
  const p = palier(gagnes);
  const d = useMemo(() => defis(profil.activites), [profil.activites]);
  const liste = useMemo(() => badges(profil.activites), [profil.activites]);
  const s = useMemo(() => saison(profil.activites), [profil.activites]);
  const obtenus = new Set(liste.filter((b) => b.obtenu).map((b) => b.id));
  const annee = new Date().getFullYear();

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <View style={{ backgroundColor: C.foret, borderRadius: 26, padding: 22, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 20, ...OMBRE }}>
        <Anneau part={p.avance} niveau={p.rang + 1} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ color: "#F6F4EFB3", fontSize: 13, fontWeight: "800", letterSpacing: 1 }}>{p.actuel.altitude} M</Text>
          <Text style={{ color: C.fond, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={2}>{p.actuel.nom}</Text>
          <Text style={{ color: C.fond, fontSize: 15, marginTop: 6 }}>
            <Text style={{ fontWeight: "900" }}>{nombre(gagnes)}</Text> points
          </Text>
          <Text style={{ color: "#F6F4EFB3", fontSize: 14 }}>
            {p.suivant ? `${nombre(p.suivant.points - gagnes)} pour le niveau ${p.rang + 2}` : `Niveau maximum sur ${PALIERS.length}`}
          </Text>
        </View>
      </View>

      {!profil.activites.length && (
        <View style={[S.carte, { gap: 14 }]}>
          <Text style={S.fort}>Tes points viennent de tes sorties</Text>
          <Text style={S.texte}>Ajoute le fichier GPX d'une sortie (exporté de Garmin, Coros, Suunto ou Strava) : distance, dénivelé et côtes montées sont comptés tout seuls.</Text>
          <Pressable onPress={onAjouterSortie} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Ajouter ma première sortie</Text>
          </Pressable>
        </View>
      )}

      <Section titre={`Saison ${annee}`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {([["Kilomètres", nombre(s.km)], ["Dénivelé", `${nombre(s.dplus)} m`], ["Sorties", nombre(s.sorties)], ["Côtes montées", nombre(s.montees)]] as const).map(([t, v]) => (
            <View key={t} style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: C.blanc, borderRadius: 20, padding: 18, gap: 4, ...OMBRE }}>
              <Text style={S.petit}>{t}</Text>
              <Text style={{ fontSize: 28, fontWeight: "900", color: C.encre, letterSpacing: -0.5 }}>{v}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section titre="Défis de la semaine">
        <View style={[S.carte, { marginTop: 0, gap: 18 }]}>{d.semaine.map((x) => <LigneDefi key={x.id} d={x} />)}</View>
      </Section>
      <Section titre="Défis du mois">
        <View style={[S.carte, { marginTop: 0, gap: 18 }]}>{d.mois.map((x) => <LigneDefi key={x.id} d={x} />)}</View>
      </Section>

      <Section titre="Médailles" sous={`${obtenus.size} sur ${liste.length} · les légendaires se méritent sur la trace GPS`}>
        <View style={[S.carte, { marginTop: 0, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 22 }]}>
          {liste.map((b) => <Medaille key={b.id} b={b} />)}
        </View>
      </Section>

      <Section titre="Équipement" sous={`${nombre(reste)} points à dépenser · marques de l'univers Trail-côtes`}>
        <View style={{ gap: 12 }}>
          {EQUIPEMENT.map((o) => (
            <LigneObjet key={o.id} o={o} possede={achats.includes(o.id)} reste={reste} merite={!!o.merite && obtenus.has(o.merite)}
                        onAcheter={() => setProfil({ ...profil, achats: [...achats, o.id] })} />
          ))}
        </View>
        <Text style={S.petit}>Dépenser des points ne fait pas baisser ton niveau. Les points se gagnent en courant, jamais en payant.</Text>
      </Section>
    </ScrollView>
  );
}
