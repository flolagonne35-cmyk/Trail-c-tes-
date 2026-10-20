// Éditeur d'avatar : aperçu, catégories (Corps, Visage, Cheveux, Tenue, Équipement), « Au hasard ».

import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { C, S } from "../theme.ts";
import { Avatar } from "./Avatar.tsx";
import {
  BARBES, BAS, BOUCHES, CHEVEUX, CORPULENCES, COUPES, FORMES_YEUX, HAUTS, PEAUX, SACS, SOURCILS, TAILLES, TETES, TISSUS,
  YEUX, apparenceAleatoire, type Apparence, type Choix,
} from "./modele.ts";

const CATEGORIES = ["Corps", "Visage", "Cheveux", "Tenue", "Équipement"] as const;
type Categorie = (typeof CATEGORIES)[number];

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[S.surtitre, { fontSize: 12 }]}>{titre}</Text>
      {children}
    </View>
  );
}

function Options<T extends string>({ liste, valeur, onChange }: { liste: Choix<T>[]; valeur: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {liste.map((c) => {
        const actif = c.valeur === valeur;
        return (
          <Pressable key={c.valeur} onPress={() => onChange(c.valeur)} accessibilityRole="button" aria-selected={actif}
                     style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center",
                              backgroundColor: actif ? C.encre : C.blanc, borderWidth: 1, borderColor: actif ? C.encre : C.sable }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: actif ? C.fond : C.encre }}>{c.nom}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Couleurs({ couleurs, valeur, onChange, nom }: { couleurs: string[]; valeur: number; onChange: (i: number) => void; nom: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {couleurs.map((c, i) => (
        <Pressable key={`${c}${i}`} onPress={() => onChange(i)} accessibilityRole="button" accessibilityLabel={`${nom} ${i + 1}`}
                   aria-selected={i === valeur}
                   style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
                            borderWidth: 2.5, borderColor: i === valeur ? C.encre : "transparent" }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 1, borderColor: "#0000001F" }} />
        </Pressable>
      ))}
    </View>
  );
}

function Interrupteur({ nom, valeur, onChange }: { nom: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      <Text style={[S.fort, { fontWeight: "600" }]}>{nom}</Text>
      <Switch value={valeur} onValueChange={onChange} accessibilityLabel={nom} />
    </View>
  );
}

export function EditeurAvatar({ prenomInitial, apparenceInitiale, titre, action, onValider, onAnnuler }: {
  prenomInitial: string; apparenceInitiale: Apparence; titre: string; action: string;
  onValider: (prenom: string, a: Apparence) => void; onAnnuler?: () => void;
}) {
  const [a, setA] = useState(apparenceInitiale);
  const [prenom, setPrenom] = useState(prenomInitial);
  const [categorie, setCategorie] = useState<Categorie>("Corps");
  const maj = (partiel: Partial<Apparence>) => setA({ ...a, ...partiel });

  return (
    <View style={S.ecran}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} stickyHeaderIndices={[1]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
          {onAnnuler && (
            <Pressable onPress={onAnnuler} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontSize: 15, color: C.gris, fontWeight: "600" }}>Annuler</Text>
            </Pressable>
          )}
          <Text style={[S.h2, { flex: 1 }]} accessibilityRole="header">{titre}</Text>
          <Pressable onPress={() => setA(apparenceAleatoire())} accessibilityRole="button"
                     style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.sable, justifyContent: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.encre }}>Au hasard</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: C.fond, paddingTop: 8 }}>
          <View style={{ alignItems: "center" }}>
            <Avatar a={a} taille={170} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 10 }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCategorie(c)} accessibilityRole="tab" aria-selected={c === categorie}
                         style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center",
                                  backgroundColor: c === categorie ? C.montee : C.sable }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: c === categorie ? C.blanc : C.encre }}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 6 }}>
          {categorie === "Corps" && <>
            <Groupe titre="Prénom ou pseudo (facultatif)">
              <TextInput value={prenom} onChangeText={setPrenom} placeholder="ex. Théo" accessibilityLabel="Prénom ou pseudo"
                         style={{ backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 16, color: C.encre }} />
            </Groupe>
            <Groupe titre="Silhouette">
              <Options liste={[{ valeur: "femme", nom: "Femme" }, { valeur: "homme", nom: "Homme" }]} valeur={a.silhouette}
                       onChange={(silhouette) => maj({ silhouette })} />
            </Groupe>
            <Groupe titre="Corpulence"><Options liste={CORPULENCES} valeur={a.corpulence} onChange={(corpulence) => maj({ corpulence })} /></Groupe>
            <Groupe titre="Taille"><Options liste={TAILLES} valeur={a.taille} onChange={(taille) => maj({ taille })} /></Groupe>
            <Groupe titre="Peau"><Couleurs couleurs={PEAUX} valeur={a.peau} onChange={(peau) => maj({ peau })} nom="Teinte de peau" /></Groupe>
          </>}

          {categorie === "Visage" && <>
            <Groupe titre="Yeux"><Options liste={FORMES_YEUX} valeur={a.yeux} onChange={(yeux) => maj({ yeux })} /></Groupe>
            <Groupe titre="Couleur des yeux">
              <Couleurs couleurs={YEUX} valeur={a.couleurYeux} onChange={(couleurYeux) => maj({ couleurYeux })} nom="Couleur des yeux" />
            </Groupe>
            <Groupe titre="Sourcils"><Options liste={SOURCILS} valeur={a.sourcils} onChange={(sourcils) => maj({ sourcils })} /></Groupe>
            <Groupe titre="Expression"><Options liste={BOUCHES} valeur={a.bouche} onChange={(bouche) => maj({ bouche })} /></Groupe>
            <Groupe titre="Barbe"><Options liste={BARBES} valeur={a.barbe} onChange={(barbe) => maj({ barbe })} /></Groupe>
            <Interrupteur nom="Taches de rousseur" valeur={a.taches} onChange={(taches) => maj({ taches })} />
          </>}

          {categorie === "Cheveux" && <>
            <Groupe titre="Coupe"><Options liste={COUPES} valeur={a.coupe} onChange={(coupe) => maj({ coupe })} /></Groupe>
            <Groupe titre="Couleur"><Couleurs couleurs={CHEVEUX} valeur={a.cheveux} onChange={(cheveux) => maj({ cheveux })} nom="Couleur des cheveux" /></Groupe>
          </>}

          {categorie === "Tenue" && <>
            <Groupe titre="Haut"><Options liste={HAUTS} valeur={a.haut} onChange={(haut) => maj({ haut })} /></Groupe>
            <Groupe titre="Couleur du haut"><Couleurs couleurs={TISSUS} valeur={a.couleurHaut} onChange={(couleurHaut) => maj({ couleurHaut })} nom="Couleur du haut" /></Groupe>
            <Groupe titre="Bande et détails"><Couleurs couleurs={TISSUS} valeur={a.couleurBande} onChange={(couleurBande) => maj({ couleurBande })} nom="Couleur des détails" /></Groupe>
            <Groupe titre="Bas"><Options liste={BAS} valeur={a.bas} onChange={(bas) => maj({ bas })} /></Groupe>
            <Groupe titre="Couleur du bas"><Couleurs couleurs={TISSUS} valeur={a.couleurBas} onChange={(couleurBas) => maj({ couleurBas })} nom="Couleur du bas" /></Groupe>
            <Groupe titre="Chaussures"><Couleurs couleurs={TISSUS} valeur={a.chaussures} onChange={(chaussures) => maj({ chaussures })} nom="Couleur des chaussures" /></Groupe>
          </>}

          {categorie === "Équipement" && <>
            <Groupe titre="Sur la tête"><Options liste={TETES} valeur={a.tete} onChange={(tete) => maj({ tete })} /></Groupe>
            {a.tete !== "aucun" && (
              <Groupe titre="Couleur"><Couleurs couleurs={TISSUS} valeur={a.couleurTete} onChange={(couleurTete) => maj({ couleurTete })} nom="Couleur du couvre-chef" /></Groupe>
            )}
            <Groupe titre="Hydratation"><Options liste={SACS} valeur={a.sac} onChange={(sac) => maj({ sac })} /></Groupe>
            {a.sac !== "aucun" && (
              <Groupe titre="Couleur du gilet"><Couleurs couleurs={TISSUS} valeur={a.couleurSac} onChange={(couleurSac) => maj({ couleurSac })} nom="Couleur du gilet" /></Groupe>
            )}
            <Interrupteur nom="Lunettes de sport" valeur={a.lunettes} onChange={(lunettes) => maj({ lunettes })} />
            <Interrupteur nom="Montre GPS" valeur={a.montre} onChange={(montre) => maj({ montre })} />
            <Interrupteur nom="Bâtons de trail" valeur={a.batons} onChange={(batons) => maj({ batons })} />
            <Groupe titre="Numéro de dossard (facultatif)">
              <TextInput value={a.dossard} onChangeText={(dossard) => maj({ dossard: dossard.replace(/[^0-9A-Za-z]/g, "").slice(0, 4) })}
                         placeholder="ex. 1234" accessibilityLabel="Numéro de dossard"
                         style={{ backgroundColor: C.blanc, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 16, color: C.encre }} />
            </Groupe>
          </>}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: C.fond,
                     borderTopWidth: 1, borderTopColor: C.sable }}>
        {/* rien n'est obligatoire : sans prénom, on garde « Coureur » */}
        <Pressable onPress={() => onValider(prenom.trim() || "Coureur", a)} accessibilityRole="button" style={S.bouton}>
          <Text style={S.boutonTexte}>{action}</Text>
        </Pressable>
      </View>
    </View>
  );
}
