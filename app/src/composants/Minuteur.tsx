// Minuteur de répétitions en côte : gros chiffres lisibles en courant, un appui en haut de la côte,
// la récupération se compte toute seule (vibration à la fin, sur Android et dans les navigateurs qui
// le permettent ; l'iPhone ne laisse pas vibrer une page web).

import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, Vibration, View } from "react-native";

import { C, S } from "../theme.ts";
import { Ajusteur } from "./communs.tsx";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function vibrer(motif: number[]) {
  try {
    if (Platform.OS === "web") (navigator as Navigator & { vibrate?: (m: number[]) => boolean }).vibrate?.(motif);
    else Vibration.vibrate(motif);
  } catch { /* pas de vibreur : tant pis */ }
}

type Phase = { nom: "pret" } | { nom: "montee"; n: number; debut: number } | { nom: "recup"; n: number; fin: number } | { nom: "fini" };

export function Minuteur({ repetitionsInitiales = 8 }: { repetitionsInitiales?: number }) {
  const [repetitions, setRepetitions] = useState(repetitionsInitiales);
  const [recup, setRecup] = useState(90);
  const [phase, setPhase] = useState<Phase>({ nom: "pret" });
  const [temps, setTemps] = useState<number[]>([]);
  const [maintenant, setMaintenant] = useState(Date.now());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (phase.nom !== "montee" && phase.nom !== "recup") return;
    const t = setInterval(() => {
      const ici = Date.now();
      setMaintenant(ici);
      const p = phaseRef.current;
      if (p.nom === "recup" && ici >= p.fin) {
        vibrer([300, 150, 300]);
        setPhase({ nom: "montee", n: p.n + 1, debut: ici });
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase.nom]);

  const enHaut = () => {
    if (phase.nom !== "montee") return;
    const ici = Date.now();
    const liste = [...temps, (ici - phase.debut) / 1000];
    setTemps(liste);
    vibrer([150]);
    setPhase(phase.n >= repetitions ? { nom: "fini" } : { nom: "recup", n: phase.n, fin: ici + recup * 1000 });
  };
  const gros = { fontSize: 64, fontWeight: "900" as const, color: C.encre, textAlign: "center" as const };

  return (
    <View style={[S.carte, { gap: 12 }]}>
      <Text style={S.h2}>Minuteur de répétitions</Text>
      {phase.nom === "pret" && (
        <>
          <Ajusteur etiquette="Répétitions" valeur={repetitions} unite="" pas={1} min={1} max={30} onChange={setRepetitions} />
          <Ajusteur etiquette="Récupération (descente)" valeur={recup} unite="s" pas={15} min={15} max={300} onChange={setRecup} />
          <Text style={S.petit}>
            Récup conseillée : à peu près le temps de la montée en côtes courtes (force), en redescendant en trottinant.
            Au bout de la récup, le téléphone vibre : c'est reparti.
          </Text>
          <Pressable onPress={() => { setTemps([]); setPhase({ nom: "montee", n: 1, debut: Date.now() }); }}
                     accessibilityRole="button" style={[S.bouton, { minHeight: 56 }]}>
            <Text style={[S.boutonTexte, { fontSize: 17 }]}>Partir : montée 1</Text>
          </Pressable>
        </>
      )}
      {phase.nom === "montee" && (
        <>
          <Text style={[S.fort, { textAlign: "center" }]}>Montée {phase.n} sur {repetitions}</Text>
          <Text style={gros} accessibilityLiveRegion="polite">{mmss((maintenant - phase.debut) / 1000)}</Text>
          <Pressable onPress={enHaut} accessibilityRole="button"
                     style={{ minHeight: 88, borderRadius: 20, backgroundColor: C.montee, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.blanc, fontSize: 24, fontWeight: "900" }}>En haut !</Text>
          </Pressable>
        </>
      )}
      {phase.nom === "recup" && (
        <>
          <Text style={[S.fort, { textAlign: "center" }]}>Récupération · montée {phase.n} en {mmss(temps.at(-1) ?? 0)}</Text>
          <Text style={[gros, { color: C.descente }]}>{mmss(Math.max(0, (phase.fin - maintenant) / 1000))}</Text>
          <Pressable onPress={() => setPhase({ nom: "montee", n: phase.n + 1, debut: Date.now() })} accessibilityRole="button" style={S.boutonClair}>
            <Text style={S.boutonClairTexte}>Repartir maintenant</Text>
          </Pressable>
        </>
      )}
      {phase.nom === "fini" && (
        <Text style={[S.fort, { textAlign: "center", fontSize: 20 }]}>Bravo, {temps.length} montées !</Text>
      )}
      {temps.length > 0 && (
        <Text style={[S.petit, { fontSize: 14, color: C.encre }]}>
          Temps : {temps.map(mmss).join(" · ")}
          {temps.length > 2 && Math.max(...temps) > Math.min(...temps) * 1.1 ? " · plus de 10 % d'écart : la prochaine fois, pars un peu moins vite." : ""}
        </Text>
      )}
      {(phase.nom === "fini" || phase.nom === "montee" || phase.nom === "recup") && (
        <Pressable onPress={() => setPhase({ nom: "pret" })} accessibilityRole="button" style={S.boutonClair}>
          <Text style={S.boutonClairTexte}>{phase.nom === "fini" ? "Nouvelle série" : "Arrêter"}</Text>
        </Pressable>
      )}
    </View>
  );
}
