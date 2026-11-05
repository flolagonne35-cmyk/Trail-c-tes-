// Mon monde → « Mon aventure » : le coureur sur son chemin de montagne (il monte avec les points),
// les défis de la semaine et du mois, les badges à collectionner (commun → légendaire) et la boutique
// de décors. Animé : le coureur respire, le chemin se remplit, les objets légendaires brillent.

import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from "react-native-svg";

import { Avatar } from "../avatar/Avatar.tsx";
import { badges, DECORS, defis, palier, PALIERS, RARETES, solde, type Badge, type Defi } from "../calcul/monde.ts";
import { score } from "../calcul/points.ts";
import { nombre, Section } from "../composants/communs.tsx";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

const LARGEUR = 350;
const HAUTEUR = 300;
// lacets du chemin, du bas (vallée) au sommet : un point par palier
const LACETS = PALIERS.map((_, i) => {
  const y = HAUTEUR - 26 - (i * (HAUTEUR - 60)) / (PALIERS.length - 1);
  const x = i === PALIERS.length - 1 ? LARGEUR / 2 : i % 2 ? LARGEUR * 0.7 - i * 6 : LARGEUR * 0.3 + i * 6;
  return { x, y };
});

/** Animation en boucle (respiration, scintillement). */
function useBoucle(duree: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(v, { toValue: 0, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    a.start();
    return () => a.stop();
  }, [v, duree]);
  return v;
}

/** Valeur qui monte de 0 à `cible` à l'ouverture de l'écran. */
function useMontee(cible: number, duree = 1400) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: cible, duration: duree, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, cible, duree]);
  return v;
}

function Chemin({ profil, gagnes }: { profil: Profil; gagnes: number }) {
  const p = palier(gagnes);
  const decor = DECORS.find((d) => d.id === (profil.decor ?? "vallee")) ?? DECORS[0];
  const position = useMontee(p.rang + p.avance);
  const respire = useBoucle(1400);
  const entree = PALIERS.map((_, i) => i);
  const x = position.interpolate({ inputRange: entree, outputRange: LACETS.map((l) => l.x - 26) });
  const y = position.interpolate({ inputRange: entree, outputRange: LACETS.map((l) => l.y - 58) });
  const saut = respire.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  return (
    <View style={{ marginTop: 6, borderRadius: 24, overflow: "hidden", height: HAUTEUR, backgroundColor: decor.ciel[1] }}
          accessibilityLabel={`Ton coureur est au palier « ${p.actuel.nom} », ${p.actuel.altitude} mètres`}>
      <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={decor.ciel[0]} /><Stop offset="1" stopColor={decor.ciel[1]} />
          </LinearGradient>
        </Defs>
        <Path d={`M0 0 H${LARGEUR} V${HAUTEUR} H0 Z`} fill="url(#ciel)" />
        {decor.id === "nuit" && [[40, 30], [90, 60], [150, 25], [230, 45], [300, 20], [320, 70], [200, 80]].map(([cx, cy]) => (
          <Circle key={`${cx}`} cx={cx} cy={cy} r={1.6} fill="#FFF" opacity={0.9} />
        ))}
        <Path d={`M0 ${HAUTEUR} L0 170 L70 110 L120 150 L175 22 L230 120 L280 90 L${LARGEUR} 150 L${LARGEUR} ${HAUTEUR} Z`} fill={decor.monts[0]} />
        <Path d={`M175 22 L160 50 L172 46 L180 58 L190 48 L175 22 Z`} fill="#FFFFFF" opacity={0.85} />
        <Path d={`M0 ${HAUTEUR} L0 230 L90 190 L170 240 L260 200 L${LARGEUR} 235 L${LARGEUR} ${HAUTEUR} Z`} fill={decor.monts[1]} />
        <Polyline points={LACETS.map((l) => `${l.x},${l.y}`).join(" ")} fill="none" stroke="#FFFFFF" strokeWidth={5}
                  strokeDasharray="2 9" strokeLinecap="round" opacity={0.9} />
        {LACETS.map((l, i) => (
          <Circle key={i} cx={l.x} cy={l.y} r={i <= p.rang ? 7 : 5} fill={i <= p.rang ? C.montee : "#FFFFFF"}
                  stroke={i <= p.rang ? "#FFFFFF" : C.gris} strokeWidth={2} />
        ))}
      </Svg>
      <Animated.View style={{ position: "absolute", left: 0, top: 0, transform: [{ translateX: x }, { translateY: Animated.add(y, saut) }] }}>
        <Avatar a={profil.apparence} taille={52} fond={false} />
      </Animated.View>
      <View style={{ position: "absolute", left: 12, top: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "65%" }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: C.gris }}>{p.actuel.altitude} m</Text>
          <Text style={{ fontSize: 16, fontWeight: "900", color: C.encre }} numberOfLines={1}>{p.actuel.nom}</Text>
        </View>
        <View style={{ backgroundColor: C.encre, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: C.fond }}>{nombre(gagnes)}</Text>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#F4F1EAB3" }}>points</Text>
        </View>
      </View>
    </View>
  );
}

function Barre({ part, couleur }: { part: number; couleur: string }) {
  const v = useMontee(Math.min(1, part), 1100);
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: C.aire, overflow: "hidden" }}>
      <Animated.View style={{ height: "100%", borderRadius: 6, backgroundColor: couleur,
                              width: v.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

function LigneDefi({ d }: { d: Defi }) {
  const fait = d.valeur >= d.cible;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={[S.fort, { flex: 1, fontWeight: "700" }]}>{fait ? "✅ " : ""}{d.titre}</Text>
        <Text style={[S.petit, { color: C.encre }]}>{nombre(Math.min(d.valeur, d.cible))} / {nombre(d.cible)} {d.unite}</Text>
      </View>
      <Barre part={d.valeur / d.cible} couleur={fait ? C.descente : C.montee} />
    </View>
  );
}

function CarteBadge({ b }: { b: Badge }) {
  const r = RARETES[b.rarete];
  const brille = useBoucle(1100);
  const legendaire = b.obtenu && b.rarete === "legendaire";
  return (
    <View style={{ width: "31%", minWidth: 100, alignItems: "center", gap: 6, padding: 10, borderRadius: 16,
                   backgroundColor: b.obtenu ? r.fond : C.blanc, borderWidth: 2, borderColor: b.obtenu ? r.couleur : C.aire }}
          accessible accessibilityLabel={`${b.nom}, ${r.nom}, ${b.obtenu ? "obtenu" : `${Math.round(b.avancement * 100)} %`} : ${b.detail}`}>
      <Animated.View style={{ width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center",
                              backgroundColor: b.obtenu ? r.couleur : C.aire,
                              opacity: legendaire ? brille.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) : 1,
                              transform: legendaire ? [{ scale: brille.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] : [] }}>
        <Text style={{ fontSize: 24 }}>{b.obtenu ? "🏅" : "🔒"}</Text>
      </Animated.View>
      <Text style={{ fontSize: 13, fontWeight: "800", color: C.encre, textAlign: "center" }} numberOfLines={2}>{b.nom}</Text>
      <Text style={{ fontSize: 11, fontWeight: "700", color: r.couleur }}>{r.nom}</Text>
      {!b.obtenu && <Text style={{ fontSize: 11, color: C.gris }}>{Math.round(b.avancement * 100)} %</Text>}
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
  const obtenus = liste.filter((b) => b.obtenu).length;
  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
      <Chemin profil={profil} gagnes={gagnes} />
      <View style={[S.carte, { gap: 8 }]}>
        {p.suivant ? (
          <>
            <Text style={S.fort}>Prochain palier : {p.suivant.nom} ({p.suivant.altitude} m)</Text>
            <Barre part={p.avance} couleur={C.montee} />
            <Text style={S.petit}>Encore {nombre(p.suivant.points - gagnes)} points. 1 point par km, 1 par 10 m de D+, et des points pour chaque côte montée.</Text>
          </>
        ) : <Text style={[S.fort, { color: C.monteeFonce }]}>Tu as atteint le Sommet. Respect.</Text>}
        {!profil.activites.length && (
          <Pressable onPress={onAjouterSortie} accessibilityRole="button" style={S.bouton}>
            <Text style={S.boutonTexte}>Ajouter ma première sortie (GPX)</Text>
          </Pressable>
        )}
      </View>

      <Section titre="Défis de la semaine">
        <View style={[S.carte, { marginTop: 0, gap: 14 }]}>{d.semaine.map((x) => <LigneDefi key={x.id} d={x} />)}</View>
      </Section>
      <Section titre="Défis du mois">
        <View style={[S.carte, { marginTop: 0, gap: 14 }]}>{d.mois.map((x) => <LigneDefi key={x.id} d={x} />)}</View>
      </Section>

      <Section titre={`Mes badges · ${obtenus} sur ${liste.length}`}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          {liste.map((b) => <CarteBadge key={b.id} b={b} />)}
        </View>
        <Text style={[S.petit, { marginTop: 8 }]}>Les badges légendaires ne s'achètent pas : ils se méritent, sur la trace GPS.</Text>
      </Section>

      <Section titre={`Boutique de décors · ${nombre(reste)} points à dépenser`}>
        <View style={{ gap: 10 }}>
          {DECORS.map((x) => {
            const possede = x.prix === 0 || achats.includes(x.id);
            const porte = (profil.decor ?? "vallee") === x.id;
            const r = RARETES[x.rarete];
            const assez = reste >= x.prix;
            return (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.blanc, borderRadius: 16, padding: 12,
                                        borderWidth: 2, borderColor: porte ? r.couleur : C.blanc }}>
                <View style={{ width: 64, height: 48, borderRadius: 10, overflow: "hidden" }}>
                  <Svg width={64} height={48} viewBox="0 0 64 48">
                    <Defs>
                      <LinearGradient id={`d${x.id}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={x.ciel[0]} /><Stop offset="1" stopColor={x.ciel[1]} />
                      </LinearGradient>
                    </Defs>
                    <Path d="M0 0H64V48H0Z" fill={`url(#d${x.id})`} />
                    <Path d="M0 48 L0 30 L18 16 L30 28 L42 8 L64 30 L64 48 Z" fill={x.monts[0]} />
                    <Path d="M0 48 L0 40 L24 32 L44 42 L64 36 L64 48 Z" fill={x.monts[1]} />
                  </Svg>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={S.fort}>{x.nom}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: r.couleur }}>{r.nom}{x.prix ? ` · ${nombre(x.prix)} points` : " · offert"}</Text>
                </View>
                {porte ? <Text style={{ fontWeight: "800", color: r.couleur }}>Porté</Text>
                  : possede ? (
                    <Pressable onPress={() => setProfil({ ...profil, decor: x.id })} accessibilityRole="button" accessibilityLabel={`Choisir le décor ${x.nom}`}
                               style={[S.boutonClair, { minHeight: 40 }]}>
                      <Text style={S.boutonClairTexte}>Choisir</Text>
                    </Pressable>
                  ) : (
                    <Pressable disabled={!assez} onPress={() => setProfil({ ...profil, achats: [...achats, x.id], decor: x.id })}
                               accessibilityRole="button" aria-disabled={!assez} accessibilityLabel={`Acheter le décor ${x.nom} pour ${x.prix} points`}
                               style={[S.bouton, { minHeight: 40, opacity: assez ? 1 : 0.4 }]}>
                      <Text style={S.boutonTexte}>Acheter</Text>
                    </Pressable>
                  )}
              </View>
            );
          })}
        </View>
        <Text style={[S.petit, { marginTop: 8 }]}>
          Les points dépensés restent comptés pour les paliers et le classement. Bientôt : équipement pour ton coureur (bâtons,
          frontales…), ligues de la semaine entre coureurs de même niveau, « Roi de la côte ».
        </Text>
      </Section>
    </ScrollView>
  );
}
