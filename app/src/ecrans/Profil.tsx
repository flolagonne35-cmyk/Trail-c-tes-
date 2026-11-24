// Onglet « Profil » : mon coureur, mes points, ajouter une sortie, mes sorties, classement, barème.

import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Avatar3D } from "../avatar3d/Avatar3D.tsx";
import { Monogramme } from "../composants/Monogramme.tsx";
import { corpsPour } from "../avatar3d/corps.ts";
import type { Cote } from "../calcul/cotes.ts";
import { activiteDepuisGpx, activiteDepuisPhoto, BAREME, pointsDe, score, type Activite } from "../calcul/points.ts";
import { palier, PALIERS } from "../calcul/monde.ts";
import { choisirImage, lireCapture } from "../capture.ts";
import { Icone, nombre, Section, Segments, Tuiles } from "../composants/communs.tsx";
import { choisirGpx } from "../fichiers.ts";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

const champ = { backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 12, minHeight: 46, fontSize: 15,
                color: C.encre } as const;

const STATUT: Record<Activite["statut"], [string, string, string]> = {
  validee: ["Validée", C.platClair, C.platFonce],
  en_attente: ["En attente", C.descenteClair, C.descenteFonce],
  refusee: ["Refusée", C.monteeClair, C.monteeFonce],
};

export function EcranProfil({ profil, setProfil, cotes, onPersonnaliser, onDonnees }: {
  profil: Profil; setProfil: (p: Profil) => void; cotes: Cote[]; onPersonnaliser: () => void; onDonnees: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saisie, setSaisie] = useState({ date: new Date().toISOString().slice(0, 10), km: "", dplus: "", duree: "" });
  const { valides, enAttente } = score(profil.activites);
  const validees = profil.activites.filter((a) => a.statut === "validee");

  const ajouter = (a: Activite) => {
    setProfil({ ...profil, activites: [a, ...profil.activites] });
    setMessage(a.statut === "refusee" ? `Sortie refusée : ${a.motif}`
      : a.statut === "en_attente" ? `${pointsDe(a)} points en attente de validation.`
      : `+${pointsDe(a)} points${a.repetitions.length ? `, dont ${a.repetitions.reduce((s, r) => s + r.n, 0)} montées de côtes` : ""}.`);
  };
  async function ajouterGpx() {
    setMessage(null);
    try {
      const f = await choisirGpx();
      if (f) ajouter(activiteDepuisGpx(f.texte, cotes, profil.creeLe, profil.activites.map((a) => a.empreinte)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  // capture Strava / Garmin : l'IA lit les chiffres, le coureur vérifie puis enregistre
  const [lecture, setLecture] = useState<"repos" | "en_cours" | "lue" | "manuelle">("repos");
  const [titre, setTitre] = useState<string | null>(null);
  async function choisirPhoto() {
    setMessage(null);
    const img = await choisirImage().catch(() => null);
    if (!img) return;
    setPhoto(img.apercu);
    setLecture("en_cours");
    try {
      const l = await lireCapture("activite", img.donnees);
      setSaisie({ date: l.date ?? saisie.date, km: l.distance_km ? String(l.distance_km).replace(".", ",") : "",
                  dplus: l.dplus_m !== null ? String(Math.round(l.dplus_m)) : "", duree: l.duree_min ? String(Math.round(l.duree_min)) : "" });
      setTitre(l.titre);
      setLecture(l.distance_km ? "lue" : "manuelle");
      if (!l.distance_km) setMessage("Je n'ai pas trouvé la distance sur cette image : écris les chiffres ci-dessous.");
    } catch (e) {
      setLecture("manuelle");
      setMessage(`${e instanceof Error ? e.message : "Lecture impossible."} Écris les chiffres ci-dessous.`);
    }
  }
  function envoyerPhoto() {
    const km = parseFloat(saisie.km.replace(",", "."));
    const dplus = parseFloat(saisie.dplus.replace(",", ".") || "0");
    const duree = parseFloat(saisie.duree.replace(",", ".") || "");
    if (!photo || !Number.isFinite(km) || km <= 0 || !Number.isFinite(dplus) || !/^\d{4}-\d{2}-\d{2}$/.test(saisie.date)) {
      setMessage("Il faut la capture, la date (AAAA-MM-JJ), la distance et le D+.");
      return;
    }
    ajouter(activiteDepuisPhoto({ date: `${saisie.date}T12:00:00Z`, distance_km: km, dplus_m: dplus, photo: "capture",
                                  duree_min: Number.isFinite(duree) ? duree : null, luParIA: lecture === "lue", titre },
                                profil.creeLe, profil.activites.map((a) => a.empreinte)));
    setPhoto(null);
    setLecture("repos");
    setSaisie({ ...saisie, km: "", dplus: "", duree: "" });
  }

  // récapitulatif par semaine, mois ou année (retour du 24/11)
  const [periode, setPeriode] = useState<"semaine" | "mois" | "annee">("mois");
  const [decalage, setDecalage] = useState(0);
  const recap = useMemo(() => recapitulatif(profil.activites, periode, decalage), [profil.activites, periode, decalage]);

  return (
    <ScrollView style={S.ecran} contentContainerStyle={S.contenu} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center", marginTop: 12 }}>
        <Avatar3D corps={profil.corps ?? corpsPour(profil.apparence.silhouette)} hauteur={440} />
        <Text style={[S.titre, { marginTop: 10 }]}>{profil.prenom}</Text>
        <Text style={S.petit}>Points comptés depuis le {new Date(profil.creeLe).toLocaleDateString("fr-FR")}</Text>
        <Pressable onPress={onPersonnaliser} accessibilityRole="button" style={[S.boutonClair, { marginTop: 12, minHeight: 44, alignSelf: "stretch" }]}>
          <Text style={S.boutonClairTexte}>Personnaliser mon coureur</Text>
        </Pressable>
      </View>
      <Tuiles valeurs={[["Points", nombre(valides)], ["En attente", nombre(enAttente)], ["Sorties", nombre(validees.length)]]} />

      <Section titre="Ajouter une sortie">
        <View style={[S.carte, { marginTop: 0, gap: 10 }]}>
          <Pressable onPress={ajouterGpx} accessibilityRole="button" style={[S.bouton, { flexDirection: "row", gap: 8 }]}>
            <Icone nom="gpx" couleur={C.fond} /><Text style={S.boutonTexte}>Fichier GPX</Text>
          </Pressable>
          <Text style={S.petit}>Validé tout de suite. Garmin Connect et Strava exportent le GPX d'une sortie ; les montées des
            côtes de l'appli sont comptées automatiquement.</Text>
          <Pressable onPress={choisirPhoto} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>{photo ? "Choisir une autre capture" : "Capture d'écran Strava / Garmin (galerie)"}</Text>
          </Pressable>
          <Text style={S.petit}>Choisis la capture de ta sortie dans ta galerie : l'IA lit la distance, le D+, la durée et la date. Tu vérifies, puis
            tu enregistres. La capture est envoyée seulement pour cette lecture, et n'est pas gardée.</Text>
          {lecture === "en_cours" && <Text style={S.fort}>Lecture de la capture…</Text>}
          {photo && lecture !== "en_cours" && (
            <View style={{ gap: 8 }}>
              <Text style={S.fort}>{lecture === "lue" ? "Vérifie les chiffres lus" : "Écris les chiffres de ta sortie"}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={saisie.date} onChangeText={(date) => setSaisie({ ...saisie, date })} placeholder="AAAA-MM-JJ"
                           style={[champ, { flex: 1.3, minWidth: 0 }]} accessibilityLabel="Date de la sortie" />
                <TextInput value={saisie.km} onChangeText={(km) => setSaisie({ ...saisie, km })} placeholder="km"
                           keyboardType="decimal-pad" style={[champ, { flex: 1, minWidth: 0 }]} accessibilityLabel="Distance en km" />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput value={saisie.dplus} onChangeText={(dplus) => setSaisie({ ...saisie, dplus })} placeholder="D+ m"
                           keyboardType="decimal-pad" style={[champ, { flex: 1, minWidth: 0 }]} accessibilityLabel="Dénivelé positif en mètres" />
                <TextInput value={saisie.duree} onChangeText={(duree) => setSaisie({ ...saisie, duree })} placeholder="durée (min)"
                           keyboardType="decimal-pad" style={[champ, { flex: 1, minWidth: 0 }]} accessibilityLabel="Durée en minutes" />
              </View>
              <Pressable onPress={envoyerPhoto} accessibilityRole="button" style={S.bouton}>
                <Text style={S.boutonTexte}>{lecture === "lue" ? "C'est bon, enregistrer" : "Envoyer pour validation"}</Text>
              </Pressable>
              <Text style={S.petit}>{lecture === "lue" ? "Lue par l'IA et plausible (date, vitesse) : validée tout de suite."
                : "Saisie à la main : en attente, comptée quand les comptes en ligne permettront de la vérifier."}</Text>
            </View>
          )}
          {message && <Text style={{ color: message.startsWith("+") ? C.platFonce : C.monteeFonce, fontWeight: "600" }}
                            accessibilityRole="alert">{message}</Text>}
        </View>
      </Section>

      <Section titre="Classement">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[S.fort, { width: 22 }]}>1</Text>
            <Monogramme prenom={profil.prenom} taille={40} />
            <Text style={[S.fort, { flex: 1 }]}>{profil.prenom} (toi)</Text>
            <Text style={S.fort}>{nombre(valides)} pts</Text>
          </View>
          <Text style={[S.petit, { color: C.encre }]}>
            Aujourd'hui, tes points restent sur ton téléphone : le classement ne compte que toi. Il comparera bientôt les points du mois,
            de trois façons : entre amis (avec un code d'invitation), dans ta ligue (30 coureurs de ton niveau, les 5 premiers montent),
            et dans ta région. Il faut pour ça des comptes en ligne : c'est la prochaine étape, et tes données ne partiront qu'avec ton accord.
          </Text>
        </View>
      </Section>

      <Section titre="Mes sorties">
        <View style={[S.carte, { marginTop: 0, gap: 12 }]}>
          <Segments options={[["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]]} valeur={periode}
                    onChange={(v) => { setPeriode(v); setDecalage(0); }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => setDecalage(decalage - 1)} accessibilityRole="button" accessibilityLabel="Période précédente" hitSlop={8}
                       style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22, color: C.encre }}>‹</Text>
            </Pressable>
            <Text style={[S.fort, { flex: 1, textAlign: "center" }]}>{recap.titre}</Text>
            <Pressable onPress={() => setDecalage(Math.min(0, decalage + 1))} disabled={decalage >= 0} accessibilityRole="button"
                       accessibilityLabel="Période suivante" hitSlop={8}
                       style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.sable, alignItems: "center", justifyContent: "center", opacity: decalage >= 0 ? 0.35 : 1 }}>
              <Text style={{ fontSize: 22, color: C.encre }}>›</Text>
            </Pressable>
          </View>
          <Tuiles valeurs={[["Distance", `${nombre(recap.km, recap.km < 100 ? 1 : 0)} km`], ["D+", `${nombre(recap.dplus)} m`],
                            ["Sorties", nombre(recap.sorties.length)], ["Points", nombre(recap.points)]]} />
          {recap.duree > 0 && <Text style={S.petit}>Temps de course : {Math.floor(recap.duree / 60)} h {String(Math.round(recap.duree % 60)).padStart(2, "0")} · km-effort : {nombre(recap.km + recap.dplus / 100, 0)}</Text>}
        </View>
        <View style={{ gap: 8, marginTop: 10 }}>
          {recap.sorties.length === 0 && <Text style={S.petit}>Aucune sortie sur cette période.</Text>}
          {recap.sorties.map((a) => {
            const [libelle, fond, texte] = STATUT[a.statut];
            return (
              <View key={a.id} style={[S.ligne, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={S.fort}>{new Date(a.date).toLocaleDateString("fr-FR")} · {nombre(a.distance_km, 1)} km · +{nombre(a.dplus_m)} m</Text>
                  <Text style={S.petit}>{a.source === "gpx" ? "GPX" : "Capture d'écran"}
                    {a.repetitions.map((r) => ` · ${r.n} × ${r.nom || `côte de ${Math.round(r.longueur_m)} m`}`).join("")}
                    {a.motif ? ` · ${a.motif}` : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={S.fort}>{a.statut === "refusee" ? "0" : `+${nombre(pointsDe(a))}`}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
                                 overflow: "hidden", backgroundColor: fond, color: texte }}>{libelle}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      <Section titre="Comment gagner des points">
        <View style={[S.carte, { marginTop: 0, gap: 8 }]}>
          {[[`${BAREME.parKm} points`, "par kilomètre couru"], ["10 points", "par 100 m de dénivelé positif (comme le km-effort de l'ITRA : 100 m de D+ ≈ 1 km)"],
            ["+ 1 point / 5 m de D+", "en bonus à chaque montée d'une côte de l'appli"], [`${BAREME.plafondKmSemaine} km`, "comptés au plus par semaine (contre la triche)"]]
            .map(([valeur, texte]) => (
              <View key={texte} style={{ flexDirection: "row", gap: 10 }}>
                <Text style={[S.fort, { width: 150 }]}>{valeur}</Text>
                <Text style={[S.petit, { flex: 1, color: C.encre }]}>{texte}</Text>
              </View>
            ))}
          <Text style={[S.petit, { color: C.encre }]}>
            Exemple : une année à 1 200 km et 35 000 m de D+ = 12 000 + 3 500 = 15 500 points, le niveau {palier(15500).rang + 1} sur {PALIERS.length}
            (« {palier(15500).actuel.nom} »). Les premiers niveaux viennent en quelques semaines ; le sommet ({nombre(PALIERS[PALIERS.length - 1].points)} points)
            demande une saison d'ultra-traileur.
          </Text>
          <Text style={S.petit}>Seules les sorties faites après la création du compte comptent.</Text>
        </View>
      </Section>

      <Pressable onPress={onDonnees} accessibilityRole="button" style={[S.boutonClair, { marginTop: 22 }]}>
        <Text style={S.boutonClairTexte}>Mes données et confidentialité</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Sorties et totaux d'une semaine (lundi → dimanche), d'un mois ou d'une année ; `decalage` = périodes en arrière. */
export function recapitulatif(activites: Activite[], periode: "semaine" | "mois" | "annee", decalage: number, maintenant = new Date()) {
  let debut: Date;
  let fin: Date;
  let titre: string;
  if (periode === "semaine") {
    const lundi = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - ((maintenant.getDay() + 6) % 7) + 7 * decalage);
    debut = lundi;
    fin = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7);
    titre = decalage === 0 ? "Cette semaine" : `Semaine du ${lundi.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  } else if (periode === "mois") {
    debut = new Date(maintenant.getFullYear(), maintenant.getMonth() + decalage, 1);
    fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 1);
    titre = debut.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } else {
    debut = new Date(maintenant.getFullYear() + decalage, 0, 1);
    fin = new Date(debut.getFullYear() + 1, 0, 1);
    titre = String(debut.getFullYear());
  }
  const sorties = activites.filter((a) => { const t = Date.parse(a.date); return t >= debut.getTime() && t < fin.getTime(); });
  const comptees = sorties.filter((a) => a.statut !== "refusee");
  return {
    titre: titre[0].toUpperCase() + titre.slice(1), sorties,
    km: comptees.reduce((s, a) => s + a.distance_km, 0), dplus: comptees.reduce((s, a) => s + a.dplus_m, 0),
    duree: comptees.reduce((s, a) => s + (a.duree_min ?? 0), 0), points: comptees.filter((a) => a.statut === "validee").reduce((s, a) => s + pointsDe(a), 0),
  };
}
