// Recherche d'un point de départ, en plein écran :
// - villes : toutes les communes de France, instantané et sans réseau ;
// - adresses précises : géocodage IGN (Base Adresse Nationale) quand le réseau répond ;
// - sans saisie : ma position, lieux récents.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { chercherCommunes, indexCommunes, normaliser } from "../calcul/communes.ts";
import type { Position } from "../calcul/geo.ts";
import { rechercherLieux, type Lieu } from "../calcul/geoservices.ts";
import { estFavori } from "../lieux.ts";
import { C, S } from "../theme.ts";
import { Icone } from "./communs.tsx";

// sur le web, le contour de focus du navigateur doublerait celui du champ
const SANS_CONTOUR = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[S.surtitre, { fontSize: 12, marginBottom: 6 }]}>{titre}</Text>
      <View style={{ backgroundColor: C.blanc, borderRadius: 14, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function Ligne({ icone, titre, detail, onPress, premier, favori, onFavori }: {
  icone: Parameters<typeof Icone>[0]["nom"]; titre: string; detail?: string; onPress: () => void; premier?: boolean;
  favori?: boolean; onFavori?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: premier ? 0 : 1, borderTopColor: C.aire }}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={detail ? `${titre}, ${detail}` : titre}
               style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52,
                                          paddingHorizontal: 14, paddingVertical: 8, backgroundColor: pressed ? C.aire : C.blanc })}>
      <Icone nom={icone} couleur={C.gris} taille={20} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, color: C.encre, fontWeight: "600" }} numberOfLines={1}>{titre}</Text>
        {detail ? <Text style={S.petit} numberOfLines={1}>{detail}</Text> : null}
      </View>
    </Pressable>
    {onFavori && (
      <Pressable onPress={onFavori} accessibilityRole="button" hitSlop={6}
                 accessibilityLabel={favori ? `Retirer ${titre} des favoris` : `Ajouter ${titre} aux favoris`}
                 style={{ width: 48, minHeight: 52, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 22, color: favori ? "#E0A100" : C.sable }}>{favori ? "★" : "☆"}</Text>
      </Pressable>
    )}
    </View>
  );
}

export function RechercheLieu({ pres, recents, favoris, onFavori, onLieu, onLocaliser, onFermer }: {
  pres: Position; recents: Lieu[]; favoris: Lieu[]; onFavori: (l: Lieu) => void;
  onLieu: (l: Lieu) => void; onLocaliser: () => void; onFermer: () => void;
}) {
  const etoile = (l: Lieu) => ({ favori: estFavori(favoris, l), onFavori: () => onFavori(l) });
  const [q, setQ] = useState("");
  const [adresses, setAdresses] = useState<Lieu[]>([]);
  const [etatAdresses, setEtatAdresses] = useState<"repos" | "en_cours" | "indisponible">("repos");
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const villes = useMemo(() => chercherCommunes(q, indexCommunes(), 6), [q]);

  // adresses précises : seulement si la saisie ressemble à une adresse ou si aucune ville ne correspond
  const chercherAdresses = q.trim().length >= 3 && (/\d/.test(q) || villes.length === 0 || q.trim().includes(" "));
  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    setAdresses([]);
    if (!chercherAdresses) {
      setEtatAdresses("repos");
      return;
    }
    setEtatAdresses("en_cours");
    let actif = true;
    minuteur.current = setTimeout(() => {
      rechercherLieux(q.trim(), pres)
        .then((r) => {
          if (!actif) return;
          // les communes sont déjà proposées hors ligne : on ne garde que les adresses et lieux-dits
          const noms = new Set(villes.map((v) => normaliser(v.label)));
          setAdresses(r.filter((l) => !noms.has(normaliser(l.label))));
          setEtatAdresses("repos");
        })
        .catch(() => actif && setEtatAdresses("indisponible"));
    }, 350);
    return () => {
      actif = false;
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [q, chercherAdresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const choisir = (l: Lieu) => {
    onLieu(l);
    onFermer();
  };
  const vide = q.trim().length < 2;

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.fond }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.blanc,
                       borderRadius: 14, paddingHorizontal: 12, minHeight: 48, borderWidth: 2, borderColor: C.encre }}>
          <Icone nom="recherche" couleur={C.gris} taille={20} />
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Ville, code postal ou adresse"
                     accessibilityLabel="Chercher une ville, un code postal ou une adresse" autoCorrect={false}
                     returnKeyType="search" onSubmitEditing={() => { const l = villes[0] ?? adresses[0]; if (l) choisir(l); }}
                     style={[{ flex: 1, minWidth: 0, fontSize: 16, color: C.encre, minHeight: 44 }, SANS_CONTOUR]} />
          {q ? (
            <Pressable onPress={() => setQ("")} accessibilityRole="button" accessibilityLabel="Effacer" hitSlop={8}>
              <Text style={{ fontSize: 18, color: C.gris }}>×</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onFermer} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center", paddingLeft: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: C.gris }}>Annuler</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {vide ? (
          <>
            <Groupe titre="Autour de moi">
              <Ligne premier icone="position" titre="Ma position" detail="Utiliser le GPS du téléphone"
                     onPress={() => { onLocaliser(); onFermer(); }} />
            </Groupe>
            {favoris.length > 0 && (
              <Groupe titre="Favoris">
                {favoris.map((l, i) => <Ligne key={`f${l.label}${i}`} premier={!i} icone="position" titre={l.label} detail={l.detail}
                                              onPress={() => choisir(l)} {...etoile(l)} />)}
              </Groupe>
            )}
            {recents.filter((l) => !estFavori(favoris, l)).length > 0 && (
              <Groupe titre="Récents">
                {recents.filter((l) => !estFavori(favoris, l)).map((l, i) => <Ligne key={`${l.label}${i}`} premier={!i} icone="chrono"
                                              titre={l.label} detail={l.detail} onPress={() => choisir(l)} {...etoile(l)} />)}
              </Groupe>
            )}
            <Text style={[S.petit, { marginTop: 14 }]}>
              Écris une ville, un code postal (35000), une adresse (12 rue de la Gare, Vannes) ou un lieu (gare, stade,
              lac, sommet…). Les 35 000 communes se cherchent sans réseau ; adresses et lieux utilisent le géocodage de
              l'IGN. Touche l'étoile ☆ pour garder un lieu en favori.
            </Text>
          </>
        ) : (
          <>
            {villes.length > 0 && (
              <Groupe titre="Villes">
                {villes.map((l, i) => <Ligne key={`${l.label}${l.detail}`} premier={!i} icone="accueil" titre={l.label}
                                             detail={l.detail} onPress={() => choisir(l)} {...etoile(l)} />)}
              </Groupe>
            )}
            {(adresses.length > 0 || etatAdresses !== "repos") && (
              <Groupe titre="Adresses et lieux">
                {adresses.map((l, i) => <Ligne key={`${l.label}${i}`} premier={!i} icone="position" titre={l.label}
                                               detail={l.detail} onPress={() => choisir(l)} {...etoile(l)} />)}
                {etatAdresses === "en_cours" && (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 14 }}>
                    <ActivityIndicator color={C.gris} /><Text style={S.petit}>Recherche des adresses…</Text>
                  </View>
                )}
                {etatAdresses === "indisponible" && (
                  <Text style={[S.petit, { padding: 14 }]}>
                    Adresses précises indisponibles (pas de réseau). Les villes restent cherchables.
                  </Text>
                )}
              </Groupe>
            )}
            {villes.length === 0 && adresses.length === 0 && etatAdresses === "repos" && (
              <Text style={[S.petit, { marginTop: 18, textAlign: "center" }]}>
                Aucune commune ne correspond à « {q.trim()} ». Essayez le code postal.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
