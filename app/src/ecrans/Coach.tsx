// Programme → « Coach » : un coach IA (Claude, d'Anthropic) qui connaît le programme du coureur.
// Avant tout envoi : un écran d'accord qui montre exactement ce qui part (le résumé de
// l'entraînement, jamais le prénom ni les traces GPS). La conversation reste sur le téléphone.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, type ScrollViewInstance, Text, TextInput, View } from "react-native";

import { contexteCoureur, LIMITES, type MessageCoach } from "../calcul/coach.ts";
import { lundiDe, seanceDuJour } from "../calcul/jour.ts";
import { genererPlan } from "../calcul/plan.ts";
import { chargerCoach, COACH_VIDE, demanderCoach, enregistrerCoach, type EtatCoach } from "../coach.ts";
import type { MonPlan } from "../monPlan.ts";
import type { Profil } from "../profil.ts";
import { C, S } from "../theme.ts";

const SUGGESTIONS = [
  "Explique-moi ma séance du jour",
  "Je suis fatigué : comment adapter ma semaine ?",
  "Que manger avant et pendant ma sortie longue ?",
  "Mon objectif est-il réaliste ?",
];

export function EcranCoach({ profil, monPlan, allurePlat }: { profil: Profil; monPlan: MonPlan; allurePlat: number }) {
  const [etat, setEtatBrut] = useState<EtatCoach>(COACH_VIDE);
  const [charge, setCharge] = useState(false);
  useEffect(() => { chargerCoach().then((e) => { setEtatBrut(e); setCharge(true); }); }, []);
  const setEtat = (e: EtatCoach) => { setEtatBrut(e); enregistrerCoach(e); };
  const [saisie, setSaisie] = useState("");
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirResume, setVoirResume] = useState(false);
  const defilement = useRef<ScrollViewInstance>(null);

  // le résumé envoyé au coach : programme de la semaine, séance du jour, sorties depuis lundi
  const contexte = useMemo(() => {
    const { cible, questionnaire } = monPlan;
    const plan = cible && questionnaire ? genererPlan(cible, questionnaire, allurePlat) : null;
    const lundi = new Date(`${lundiDe(new Date())}T00:00:00`);
    const faites = profil.activites.filter((a) => a.statut === "validee" && new Date(a.date) >= lundi);
    const r = seanceDuJour(plan, faites.length, cible?.nom ?? "", cible?.date);
    return contexteCoureur({
      cible, questionnaire, semaine: plan?.find((s) => s.debut === lundiDe(new Date())) ?? null,
      seanceDuJour: r.cas === "seance" || r.cas === "rattrapage" ? r.seance : null, repos: r.cas === "repos" || r.cas === "semaine_faite",
      faitesCetteSemaine: { sorties: faites.length, km: faites.reduce((t, a) => t + a.distance_km, 0), dplus: faites.reduce((t, a) => t + a.dplus_m, 0) },
    });
  }, [monPlan, profil.activites, allurePlat]);

  const envoyer = async (texte: string) => {
    const question = texte.trim().slice(0, LIMITES.caracteresMessage);
    if (!question || attente) return;
    const messages: MessageCoach[] = [...etat.messages, { role: "user", content: question }];
    setEtat({ ...etat, messages });
    setSaisie("");
    setErreur(null);
    setAttente(true);
    const r = await demanderCoach(messages.slice(-LIMITES.messages), contexte);
    setAttente(false);
    if ("texte" in r) setEtat({ ...etat, messages: [...messages, { role: "assistant", content: r.texte }] });
    else setErreur(r.erreur);
    setTimeout(() => defilement.current?.scrollToEnd({ animated: true }), 50);
  };
  // après une erreur, le dernier message du coureur est resté sans réponse : on peut le renvoyer
  const reessayer = () => {
    const dernier = etat.messages.at(-1);
    if (!dernier || dernier.role !== "user") return;
    const avant = etat.messages.slice(0, -1);
    setEtatBrut({ ...etat, messages: avant });
    setErreur(null);
    setAttente(true);
    demanderCoach([...avant, dernier].slice(-LIMITES.messages), contexte).then((r) => {
      setAttente(false);
      if ("texte" in r) setEtat({ ...etat, messages: [...avant, dernier, { role: "assistant", content: r.texte }] });
      else { setEtatBrut({ ...etat, messages: [...avant, dernier] }); setErreur(r.erreur); }
    });
  };

  if (!charge) return <View style={S.ecran} />;

  const resume = (
    <View style={{ gap: 6 }}>
      <Pressable onPress={() => setVoirResume(!voirResume)} accessibilityRole="button" aria-expanded={voirResume} hitSlop={8}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>{voirResume ? "Masquer" : "Voir"} exactement ce qui est envoyé</Text>
      </Pressable>
      {voirResume && <Text selectable style={[S.petit, { backgroundColor: C.fond, borderRadius: 10, padding: 10, color: C.encre }]}>{contexte}</Text>}
    </View>
  );

  if (!etat.accord) {
    return (
      <ScrollView style={S.ecran} contentContainerStyle={S.contenu}>
        <View style={[S.carte, { gap: 12, marginTop: 4 }]}>
          <Text style={[S.h2, { fontSize: 20 }]} accessibilityRole="header">Ton coach, à qui tu peux tout demander</Text>
          <Text style={[S.petit, { fontSize: 15, lineHeight: 22, color: C.encre }]}>
            « Explique-moi ma séance », « j'ai mal dormi, je fais quoi ? », « que manger avant ma sortie longue ? » :
            le coach connaît ton programme et te répond en quelques phrases.
          </Text>
          <Text style={S.fort}>Avant de commencer</Text>
          <Text style={[S.petit, { fontSize: 14, lineHeight: 20, color: C.encre }]}>
            Le coach est une intelligence artificielle (Claude, de la société Anthropic). Pour te répondre, l'appli lui envoie
            tes questions et un résumé de ton entraînement : course visée, programme de la semaine, records.{"\n\n"}
            Ne sont jamais envoyés : ton prénom, ta position, tes traces GPS.{"\n\n"}
            Anthropic traite ces messages aux États-Unis, les garde en principe 30 jours et ne s'en sert pas pour entraîner ses
            modèles. N'écris pas d'informations médicales précises. La conversation est gardée sur ton téléphone ; tu peux
            l'effacer et retirer ton accord à tout moment.
          </Text>
          {resume}
          <Pressable onPress={() => setEtat({ ...etat, accord: true })} accessibilityRole="button" style={[S.bouton, { minHeight: 54 }]}>
            <Text style={[S.boutonTexte, { fontSize: 16 }]}>J'ai compris, parler au coach</Text>
          </Pressable>
          <Text style={S.petit}>Le coach ne remplace ni un médecin ni un kiné. En cas de douleur ou de malaise, arrête et consulte.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={defilement} style={S.ecran} contentContainerStyle={[S.contenu, { gap: 10 }]} keyboardShouldPersistTaps="handled">
        {!etat.messages.length && (
          <View style={{ gap: 8 }}>
            <Text style={[S.fort, { marginTop: 4 }]}>Pose ta question, ou touche une idée :</Text>
            {SUGGESTIONS.map((q) => (
              <Pressable key={q} onPress={() => envoyer(q)} accessibilityRole="button" style={[S.ligne, { minHeight: 52 }]}>
                <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{q}</Text>
                <Text style={{ color: C.montee, fontWeight: "800" }}>→</Text>
              </Pressable>
            ))}
          </View>
        )}
        {etat.messages.map((m, i) => (
          <View key={i} accessible accessibilityLabel={`${m.role === "user" ? "Toi" : "Coach"} : ${m.content}`}
                style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", borderRadius: 18, paddingVertical: 10,
                         paddingHorizontal: 14, backgroundColor: m.role === "user" ? C.encre : C.blanc }}>
            <Text selectable style={{ fontSize: 16, lineHeight: 23, color: m.role === "user" ? C.fond : C.encre }}>{m.content}</Text>
          </View>
        ))}
        {attente && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={C.montee} /><Text style={S.petit}>Le coach réfléchit… (10 à 30 secondes)</Text>
          </View>
        )}
        {erreur && (
          <View style={{ gap: 8, backgroundColor: C.monteeClair, borderRadius: 14, padding: 12 }} accessibilityRole="alert">
            <Text style={{ color: C.monteeFonce, fontWeight: "700", fontSize: 15 }}>{erreur}</Text>
            <Pressable onPress={reessayer} accessibilityRole="button" style={[S.boutonClair, { minHeight: 44, backgroundColor: C.blanc }]}>
              <Text style={S.boutonClairTexte}>Réessayer</Text>
            </Pressable>
          </View>
        )}
        <View style={{ gap: 8, marginTop: 8 }}>
          {resume}
          {etat.messages.length > 0 && (
            <Pressable onPress={() => { setEtat({ ...etat, messages: [] }); setErreur(null); }} accessibilityRole="button" hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.gris }}>Effacer la conversation</Text>
            </Pressable>
          )}
          <Pressable onPress={() => { setEtat(COACH_VIDE); setErreur(null); }} accessibilityRole="button" hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.gris }}>Retirer mon accord et tout effacer</Text>
          </Pressable>
          <Text style={S.petit}>Réponses d'une intelligence artificielle : elles peuvent être fausses. Pas un avis médical.</Text>
        </View>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.fond, borderTopWidth: 1, borderTopColor: C.aire }}>
        <TextInput value={saisie} onChangeText={setSaisie} placeholder="Écris au coach…" multiline maxLength={LIMITES.caracteresMessage}
                   accessibilityLabel="Message au coach"
                   style={{ flex: 1, minHeight: 48, maxHeight: 120, backgroundColor: C.blanc, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
                            fontSize: 16, color: C.encre }} />
        <Pressable onPress={() => envoyer(saisie)} disabled={!saisie.trim() || attente} accessibilityRole="button" accessibilityLabel="Envoyer"
                   style={[S.bouton, { minWidth: 64, opacity: !saisie.trim() || attente ? 0.45 : 1 }]}>
          <Text style={S.boutonTexte}>Envoyer</Text>
        </Pressable>
      </View>
    </View>
  );
}
