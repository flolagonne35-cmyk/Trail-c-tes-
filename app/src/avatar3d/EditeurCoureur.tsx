// Créer ou modifier son coureur : le corps en 3D en haut, qui change en direct, et les réglages
// dessous, rangés en quatre étapes : toi, ton corps (taille en cm, poids en kg, morphologie),
// ton visage (peau, yeux, cheveux), ta tenue (trail ou route, haut, bas, couleurs, tête,
// lunettes), puis ton équipement (objets des marques de l'univers Trail-côtes que tu possèdes).

import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";

import { EQUIPEMENT, RARETES } from "../calcul/monde.ts";
import { Ajusteur, Segments } from "../composants/communs.tsx";
import { C, OMBRE, S } from "../theme.ts";
import { Avatar3D } from "./Avatar3D.tsx";
import {
  CHEVEUX, corpsPour, imc, MORPHOS, PEAUX, resumeCorps, TISSUS, YEUX,
  type Barbe, type Bas, type Corps, type Coupe, type Haut, type Tete,
} from "./corps.ts";
import type { Pose } from "./pose.ts";

/** Objets visibles sur le coureur (les autres restent dans l'inventaire). */
const VISIBLES = ["batons-cretal", "frontale-lumen", "gilet-givre", "gilet-everest", "montre-cadran"];

function Bloc({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 34, gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={S.h2} accessibilityRole="header">{titre}</Text>
        {sous ? <Text style={S.petit}>{sous}</Text> : null}
      </View>
      <View style={[S.carte, { marginTop: 0, gap: 20 }]}>{children}</View>
    </View>
  );
}

function Pastilles({ etiquette, couleurs, valeur, onChange }: {
  etiquette: string; couleurs: readonly (readonly [string, string])[] | readonly string[]; valeur: number; onChange: (i: number) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={[S.fort, { fontWeight: "600" }]}>{etiquette}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {couleurs.map((c, i) => {
          const [hex, nom] = typeof c === "string" ? [c, `Teinte ${i + 1}`] : c;
          const actif = i === valeur;
          return (
            <Pressable key={i} onPress={() => onChange(i)} accessibilityRole="radio" aria-checked={actif} accessibilityLabel={`${etiquette} : ${nom}`}
                       style={{ width: 44, height: 44, borderRadius: 22, padding: 3, borderWidth: 2, borderColor: actif ? C.montee : "transparent" }}>
              <View style={{ flex: 1, borderRadius: 18, backgroundColor: hex, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Choix en pastilles qui passent à la ligne (pour les listes trop longues pour des onglets). */
function Choix<T extends string>({ etiquette, options, valeur, onChange }: { etiquette: string; options: [T, string][]; valeur: T; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[S.fort, { fontWeight: "600" }]}>{etiquette}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={etiquette} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map(([v, nom]) => {
          const actif = v === valeur;
          return (
            <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="radio" aria-checked={actif} accessibilityLabel={`${etiquette} : ${nom}`}
                       style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: "center", borderWidth: 2,
                                borderColor: actif ? C.montee : C.sable, backgroundColor: actif ? C.monteeClair : C.blanc }}>
              <Text style={{ fontSize: 15, fontWeight: actif ? "800" : "600", color: C.encre }}>{nom}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function EditeurCoureur({ prenomInitial, corpsInitial, achats, titre, action, onValider, onAnnuler }: {
  prenomInitial: string; corpsInitial: Corps; achats: string[]; titre: string; action: string;
  onValider: (prenom: string, corps: Corps) => void; onAnnuler: () => void;
}) {
  const [prenom, setPrenom] = useState(prenomInitial);
  const [c, setC] = useState<Corps>(corpsInitial);
  const [pose, setPose] = useState<Pose>("course");
  const maj = (p: Partial<Corps>) => setC({ ...c, ...p });
  const { width } = useWindowDimensions();
  const large = width >= 900;
  const i = imc(c);

  const apercu = (
    <View style={{ backgroundColor: C.sable, borderRadius: 28, overflow: "hidden", ...OMBRE }}>
      <Avatar3D corps={c} hauteur={large ? 620 : 380} pose={pose} />
      <View style={{ position: "absolute", left: 16, bottom: 14, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ fontWeight: "800", color: C.encre }}>{resumeCorps(c)}</Text>
      </View>
      {/* en course pour voir la tenue en mouvement ; debout pour bien voir la silhouette */}
      <View style={{ position: "absolute", right: 12, bottom: 10, width: 200 }}>
        <Segments options={[["course", "En course"], ["debout", "Debout"]] as [Pose, string][]} valeur={pose} onChange={setPose} />
      </View>
    </View>
  );

  const reglages = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Bloc titre="Toi">
        <View style={{ gap: 8 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Prénom ou pseudo</Text>
          <TextInput value={prenom} onChangeText={setPrenom} placeholder="Ton prénom" maxLength={24} accessibilityLabel="Prénom ou pseudo"
                     style={{ backgroundColor: C.fond, borderRadius: 14, minHeight: 52, paddingHorizontal: 16, fontSize: 17, color: C.encre }} />
        </View>
        <Segments options={[["femme", "Coureuse"], ["homme", "Coureur"]]} valeur={c.sexe} onChange={(sexe) => setC(corpsPour(sexe, c))} />
      </Bloc>

      <Bloc titre="Ton corps" sous="Tes vraies mesures : le coureur prend ta silhouette. Elles servent aussi à ta nutrition (eau, caféine par kilo).">
        <Ajusteur etiquette="Taille" valeur={c.tailleCm} unite="cm" pas={1} min={140} max={210} onChange={(tailleCm) => maj({ tailleCm })} />
        <Ajusteur etiquette="Poids" valeur={c.poidsKg} unite="kg" pas={1} min={35} max={150} onChange={(poidsKg) => maj({ poidsKg })} />
        <Text style={S.petit}>Indice de masse corporelle : {i.toFixed(1).replace(".", ",")}. Il règle la corpulence du coureur ; la morphologie règle la part de muscle.</Text>
        <View style={{ gap: 10 }}>
          {MORPHOS.map(([v, nom, detail]) => {
            const actif = c.morpho === v;
            return (
              <Pressable key={v} onPress={() => maj({ morpho: v })} accessibilityRole="radio" aria-checked={actif}
                         style={{ padding: 14, borderRadius: 16, borderWidth: 2, borderColor: actif ? C.montee : C.sable, backgroundColor: actif ? C.monteeClair : C.blanc, gap: 2 }}>
                <Text style={S.fort}>{nom}</Text>
                <Text style={S.petit}>{detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </Bloc>

      <Bloc titre="Ton visage">
        <Pastilles etiquette="Peau" couleurs={PEAUX} valeur={c.peau} onChange={(peau) => maj({ peau })} />
        <Pastilles etiquette="Yeux" couleurs={YEUX} valeur={c.yeux} onChange={(yeux) => maj({ yeux })} />
        <Pastilles etiquette="Cheveux" couleurs={CHEVEUX} valeur={c.cheveux} onChange={(cheveux) => maj({ cheveux })} />
        <Choix etiquette="Coiffure" options={[["courts", "Courts"], ["attaches", "Queue de cheval"], ["chignon", "Chignon"], ["longs", "Longs détachés"], ["rases", "Rasés"]] as [Coupe, string][]}
               valeur={c.coupe} onChange={(coupe) => maj({ coupe })} />
        <Choix etiquette="Barbe" options={[["aucune", "Sans"], ["courte", "Courte"], ["fournie", "Fournie"]] as [Barbe, string][]}
               valeur={c.barbe ?? "aucune"} onChange={(barbe) => maj({ barbe })} />
      </Bloc>

      <Bloc titre="Ta tenue">
        <Segments options={[["trail", "Trail"], ["route", "Route"]]} valeur={c.profil}
                  onChange={(profil) => maj(profil === "trail" ? { profil, tete: "casquette", bas: c.bas === "collant" ? "collant" : "short" }
                                                                : { profil, tete: "visiere", bas: "short", haut: c.sexe === "femme" ? "brassiere" : "debardeur" })} />
        <View style={{ gap: 8 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Haut</Text>
          <Segments options={[["tshirt", "T-shirt"], ["debardeur", "Débardeur"], ["brassiere", "Brassière"]] as [Haut, string][]} valeur={c.haut} onChange={(haut) => maj({ haut })} />
        </View>
        <Pastilles etiquette="Couleur du haut" couleurs={TISSUS} valeur={c.couleurHaut} onChange={(couleurHaut) => maj({ couleurHaut })} />
        <View style={{ gap: 8 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Bas</Text>
          <Segments options={[["short", "Short"], ["cuissard", "Cuissard"], ["collant", "Collant"]] as [Bas, string][]} valeur={c.bas} onChange={(bas) => maj({ bas })} />
        </View>
        <Pastilles etiquette="Couleur du bas" couleurs={TISSUS} valeur={c.couleurBas} onChange={(couleurBas) => maj({ couleurBas })} />
        <Pastilles etiquette="Chaussures" couleurs={TISSUS} valeur={c.couleurChaussures} onChange={(couleurChaussures) => maj({ couleurChaussures })} />
        <View style={{ gap: 8 }}>
          <Text style={[S.fort, { fontWeight: "600" }]}>Sur la tête</Text>
          <Segments options={[["casquette", "Casquette"], ["visiere", "Visière"], ["bandeau", "Bandeau"], ["rien", "Rien"]] as [Tete, string][]}
                    valeur={c.tete} onChange={(tete) => maj({ tete })} />
        </View>
        {c.tete !== "rien" && <Pastilles etiquette="Couleur" couleurs={TISSUS} valeur={c.couleurTete} onChange={(couleurTete) => maj({ couleurTete })} />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>Lunettes de soleil</Text>
          <Switch value={c.lunettes} onValueChange={(lunettes) => maj({ lunettes })} accessibilityLabel="Lunettes de soleil" />
        </View>
      </Bloc>

      <Bloc titre="Ton équipement" sous="Les objets gagnés ou achetés avec tes points (Mon monde → Progression). Les légendaires se méritent.">
        {EQUIPEMENT.filter((o) => VISIBLES.includes(o.id)).map((o) => {
          const possede = achats.includes(o.id);
          const porte = c.equipement.includes(o.id);
          return (
            <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: possede ? 1 : 0.5 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "900", letterSpacing: 1, color: C.gris }}>{o.marque.toUpperCase()}</Text>
                <Text style={S.fort}>{o.nom}</Text>
                <Text style={[S.petit, { color: RARETES[o.rarete].couleur, fontWeight: "700" }]}>{RARETES[o.rarete].nom}{possede ? "" : " · pas encore à toi"}</Text>
              </View>
              <Switch value={porte} disabled={!possede} accessibilityLabel={`Porter ${o.nom}`}
                      onValueChange={(v) => maj({ equipement: v ? [...c.equipement, o.id] : c.equipement.filter((x) => x !== o.id) })} />
            </View>
          );
        })}
      </Bloc>

      <View style={{ gap: 10, marginTop: 30, marginBottom: 10 }}>
        <Pressable onPress={() => onValider(prenom.trim() || "Coureur", c)} accessibilityRole="button"
                   style={({ pressed }) => ({ minHeight: 58, borderRadius: 18, backgroundColor: C.montee, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: C.blanc, fontSize: 17, fontWeight: "800" }}>{action}</Text>
        </Pressable>
        <Pressable onPress={onAnnuler} accessibilityRole="button" style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.gris }}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView style={S.ecran} contentContainerStyle={[S.contenu, { paddingTop: 16 }]} keyboardShouldPersistTaps="handled">
      <Text style={S.titre} accessibilityRole="header">{titre}</Text>
      <Text style={S.sousTitre}>Fais-le tourner du doigt. Chaque réglage change ton coureur en direct.</Text>
      {large ? (
        <View style={{ flexDirection: "row", gap: 32, marginTop: 24, alignItems: "flex-start" }}>
          <View style={{ width: 380 }}>{apercu}</View>
          {reglages}
        </View>
      ) : (
        <>
          <View style={{ marginTop: 20 }}>{apercu}</View>
          {reglages}
        </>
      )}
    </ScrollView>
  );
}
