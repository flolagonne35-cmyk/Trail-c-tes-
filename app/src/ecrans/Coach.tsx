// Programme → « Coach ». Trois niveaux ; le coach en ligne est réservé à l'abonnement Trail-côtes+ :
// 1. le coach intégré répond tout de suite, sur le téléphone, sans réseau (src/calcul/coachIntegre.ts) ;
// 2. le coach en ligne (IA ouverte hébergée par Cloudflare, quota gratuit) répond aux questions
//    libres, après accord du coureur ; indisponible, le coach intégré prend le relais ;
// 3. « Demander à mon IA » ouvre ChatGPT, Claude ou Le Chat avec la question déjà préparée.

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, type ScrollViewInstance, Switch, Text, TextInput, View } from "react-native";

import { contexteCoureur, LIMITES } from "../calcul/coach.ts";
import { repondre, type Situation } from "../calcul/coachIntegre.ts";
import { lundiDe, seanceDuJour } from "../calcul/jour.ts";
import { genererPlan } from "../calcul/plan.ts";
import { ASSISTANTS, chargerCoach, COACH_VIDE, demanderCoach, enregistrerCoach, questionPreparee, type EtatCoach, type MessageAffiche } from "../coach.ts";
import { partagerTexte } from "../fichiers.ts";
import type { MonPlan } from "../monPlan.ts";
import type { Profil } from "../profil.ts";
import { AVANTAGES_PREMIUM, estPremium } from "../premium.ts";
import { C, S } from "../theme.ts";

const SUGGESTIONS = [
  "Explique-moi ma séance du jour",
  "Je suis fatigué : comment adapter ma semaine ?",
  "Que manger avant et pendant ma sortie ?",
  "Mon objectif est-il réaliste ?",
  "J'ai mal quelque part, je fais quoi ?",
];

export function EcranCoach({ profil, monPlan, allurePlat }: { profil: Profil; monPlan: MonPlan; allurePlat: number }) {
  const [etat, setEtatBrut] = useState<EtatCoach>(COACH_VIDE);
  const [charge, setCharge] = useState(false);
  useEffect(() => { chargerCoach().then((e) => { setEtatBrut(e); setCharge(true); }); }, []);
  const setEtat = (e: EtatCoach) => { setEtatBrut(e); enregistrerCoach(e); };
  const [saisie, setSaisie] = useState("");
  const [attente, setAttente] = useState(false);
  const [detail, setDetail] = useState(false);
  const defilement = useRef<ScrollViewInstance>(null);

  // la situation du coureur : pour le coach intégré (sur le téléphone) et le résumé du coach en ligne
  const { situation, contexte } = useMemo(() => {
    const { cible, questionnaire } = monPlan;
    const plan = cible && questionnaire ? genererPlan(cible, questionnaire, allurePlat) : null;
    const lundi = new Date(`${lundiDe(new Date())}T00:00:00`);
    const faites = profil.activites.filter((a) => a.statut === "validee" && new Date(a.date) >= lundi);
    const r = seanceDuJour(plan, faites.length, cible?.nom ?? "", cible?.date);
    const commun = { cible, questionnaire, semaine: plan?.find((s) => s.debut === lundiDe(new Date())) ?? null,
                     seanceDuJour: r.cas === "seance" || r.cas === "rattrapage" ? r.seance : null, repos: r.cas === "repos" || r.cas === "semaine_faite" };
    const sit: Situation = { ...commun, plan, allureMinKm: allurePlat };
    return { situation: sit, contexte: contexteCoureur({ ...commun, faitesCetteSemaine: {
      sorties: faites.length, km: faites.reduce((t, a) => t + a.distance_km, 0), dplus: faites.reduce((t, a) => t + a.dplus_m, 0) } }) };
  }, [monPlan, profil.activites, allurePlat]);

  const envoyer = async (texte: string) => {
    const question = texte.trim().slice(0, LIMITES.caracteresMessage);
    if (!question || attente) return;
    const messages: MessageAffiche[] = [...etat.messages, { role: "user", content: question }];
    setEtat({ ...etat, messages });
    setSaisie("");
    const local = repondre(question, situation);
    // urgence ou douleur : la règle de prudence du coach intégré, tout de suite, sans passer par l'IA
    const prudence = local.sujet === "urgence" || local.sujet === "douleur";
    let reponse: MessageAffiche = { role: "assistant", content: local.texte, source: "integre" };
    if (estPremium() && etat.accord && !prudence) {
      setAttente(true);
      const enLigne = await demanderCoach(messages.slice(-LIMITES.messages).map(({ role, content }) => ({ role, content })), contexte);
      setAttente(false);
      if (enLigne) reponse = { role: "assistant", content: enLigne, source: "ia" };
    }
    setEtat({ ...etat, messages: [...messages, reponse] });
    setTimeout(() => defilement.current?.scrollToEnd({ animated: true }), 50);
  };

  if (!charge) return <View style={S.ecran} />;
  const derniereQuestion = etat.messages.findLast((m) => m.role === "user")?.content;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={defilement} style={S.ecran} contentContainerStyle={[S.contenu, { gap: 10 }]} keyboardShouldPersistTaps="handled">
        {!estPremium() ? (
          <View style={{ backgroundColor: C.foret, borderRadius: 24, padding: 22, gap: 14, marginTop: 4 }}>
            <Text style={{ color: C.montee, fontSize: 13, fontWeight: "900", letterSpacing: 1 }}>TRAIL-CÔTES+</Text>
            <Text style={{ color: C.fond, fontSize: 22, fontWeight: "900", lineHeight: 28 }}>Le coach en ligne, avec l'abonnement</Text>
            {AVANTAGES_PREMIUM.map(([t, d]) => (
              <View key={t} style={{ gap: 2 }}>
                <Text style={{ color: C.fond, fontSize: 16, fontWeight: "800" }}>✓ {t}</Text>
                <Text style={{ color: "#F6F4EFB3", fontSize: 14, lineHeight: 20 }}>{d}</Text>
              </View>
            ))}
            <View style={{ minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.fond, fontSize: 16, fontWeight: "800" }}>Bientôt disponible</Text>
            </View>
            <Text style={{ color: "#F6F4EFB3", fontSize: 13 }}>En attendant, le coach intégré ci-dessous répond gratuitement, sur ton téléphone.</Text>
          </View>
        ) : (
          <View style={[S.carte, { marginTop: 4, gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={S.fort}>Coach en ligne (IA gratuite)</Text>
              <Text style={S.petit}>
                {etat.accord ? "Activé : tes questions libres partent vers l'IA. Sans réseau, le coach intégré répond."
                  : "Désactivé : le coach intégré répond sur ton téléphone, rien n'est envoyé."}
              </Text>
            </View>
            <Switch value={etat.accord} onValueChange={(v) => { setEtat({ ...etat, accord: v }); if (v) setDetail(true); }}
                    accessibilityLabel="Activer le coach en ligne" />
          </View>
          <Pressable onPress={() => setDetail(!detail)} accessibilityRole="button" aria-expanded={detail} hitSlop={8}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.montee }}>{detail ? "Masquer" : "Voir"} ce qui est envoyé au coach en ligne</Text>
          </Pressable>
          {detail && (
            <View style={{ gap: 8 }}>
              <Text style={[S.petit, { fontSize: 14, lineHeight: 20, color: C.encre }]}>
                Le coach en ligne est une intelligence artificielle : un modèle ouvert (Gemma de Google ou Llama de Meta) hébergé
                par Cloudflare, l'hébergeur du site. L'appli lui envoie tes questions et le résumé ci-dessous. Ne sont jamais
                envoyés : ton prénom, ta position, tes traces GPS. Cloudflare ne garde pas les conversations et ne s'en sert pas
                pour entraîner des modèles ; le traitement peut avoir lieu hors d'Europe. N'écris pas d'informations médicales
                précises. Tu peux désactiver à tout moment.
              </Text>
              <Text selectable style={[S.petit, { backgroundColor: C.fond, borderRadius: 10, padding: 10, color: C.encre }]}>{contexte}</Text>
            </View>
          )}
        </View>

        )}
        {!etat.messages.length && (
          <View style={{ gap: 8 }}>
            <Text style={S.fort}>Pose ta question, ou touche une idée :</Text>
            {SUGGESTIONS.map((q) => (
              <Pressable key={q} onPress={() => envoyer(q)} accessibilityRole="button" style={[S.ligne, { minHeight: 52 }]}>
                <Text style={[S.fort, { flex: 1, fontWeight: "600" }]}>{q}</Text>
                <Text style={{ color: C.montee, fontWeight: "800" }}>→</Text>
              </Pressable>
            ))}
          </View>
        )}
        {etat.messages.map((m, i) => (
          <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%", gap: 4 }}>
            <View accessible accessibilityLabel={`${m.role === "user" ? "Toi" : "Coach"} : ${m.content}`}
                  style={{ borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: m.role === "user" ? C.encre : C.blanc }}>
              <Text selectable style={{ fontSize: 16, lineHeight: 23, color: m.role === "user" ? C.fond : C.encre }}>{m.content}</Text>
            </View>
            {m.role === "assistant" && (
              <Text style={[S.petit, { fontSize: 12, marginLeft: 6 }]}>{m.source === "ia" ? "Coach en ligne (IA) : peut se tromper" : "Coach intégré, sur ton téléphone"}</Text>
            )}
          </View>
        ))}
        {attente && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={C.montee} /><Text style={S.petit}>Le coach en ligne réfléchit…</Text>
          </View>
        )}

        {derniereQuestion && !attente && (
          <View style={[S.carte, { gap: 8 }]}>
            <Text style={S.fort}>Demander aussi à mon IA</Text>
            <Text style={S.petit}>Ouvre ton assistant avec ta question et le résumé de ton entraînement déjà écrits. C'est toi qui l'envoies, avec ton propre compte.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ASSISTANTS.map(([nom, url]) => (
                <Pressable key={nom} onPress={() => Linking.openURL(url(questionPreparee(derniereQuestion, contexte))).catch(() => undefined)}
                           accessibilityRole="link" accessibilityLabel={`Ouvrir ${nom} avec ma question`} style={[S.boutonClair, { minHeight: 44 }]}>
                  <Text style={S.boutonClairTexte}>{nom} ↗</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => partagerTexte("Question au coach", questionPreparee(derniereQuestion, contexte))}
                         accessibilityRole="button" style={[S.boutonClair, { minHeight: 44 }]}>
                <Text style={S.boutonClairTexte}>Copier ou partager</Text>
              </Pressable>
            </View>
          </View>
        )}
        {etat.messages.length > 0 && (
          <Pressable onPress={() => setEtat({ ...etat, messages: [] })} accessibilityRole="button" hitSlop={8} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: C.gris }}>Effacer la conversation</Text>
          </Pressable>
        )}
        <Text style={S.petit}>Le coach ne remplace ni un médecin ni un kiné. En cas de douleur ou de malaise, arrête et consulte.</Text>
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
