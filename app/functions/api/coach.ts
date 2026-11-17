// Fonction serveur du coach IA (Cloudflare Pages Functions) : POST /api/coach.
// La clé Anthropic reste ici, dans les secrets du projet Pages (ANTHROPIC_API_KEY) : elle n'est
// jamais dans l'appli. Variables facultatives : COACH_MODELE (par défaut claude-fable-5-2 ;
// claude-opus-5-5 coûte deux fois moins cher), et un espace KV « LIMITES » pour limiter le nombre
// de messages par jour et par adresse (sans lui, la seule limite est le plafond de dépense réglé
// dans la console Anthropic : à régler absolument).

import Anthropic from "@anthropic-ai/sdk";

import { CONSIGNES, LIMITES, messagesPourModele, validerDemande } from "../../src/calcul/coach.ts";

type KV = { get(cle: string): Promise<string | null>; put(cle: string, valeur: string, options?: { expirationTtl?: number }): Promise<void> };
type Env = { ANTHROPIC_API_KEY?: string; COACH_MODELE?: string; LIMITES?: KV };
type Contexte = { request: Request; env: Env };

const ENTETES = {
  "Content-Type": "application/json; charset=utf-8",
  // l'appli installée (Android, iPhone) appelle depuis une autre origine que le site
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};
const reponse = (statut: number, corps: Record<string, unknown>) => new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

export const onRequestOptions = () => new Response(null, { status: 204, headers: ENTETES });

export async function onRequestPost({ request, env }: Contexte): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return reponse(503, { erreur: "Le coach n'est pas encore activé sur ce site." });
  let corps: unknown;
  try {
    // 64 Ko suffisent largement : on refuse le reste avant de le lire
    if (Number(request.headers.get("content-length") ?? 0) > 65536) return reponse(413, { erreur: "Demande trop grosse." });
    corps = await request.json();
  } catch {
    return reponse(400, { erreur: "Demande illisible." });
  }
  const v = validerDemande(corps);
  if (!v.ok) return reponse(400, { erreur: v.erreur });

  // limite par jour et par adresse, si l'espace KV est branché
  if (env.LIMITES) {
    const cle = `coach:${new Date().toISOString().slice(0, 10)}:${request.headers.get("cf-connecting-ip") ?? "inconnu"}`;
    const n = Number((await env.LIMITES.get(cle)) ?? 0);
    if (n >= LIMITES.parJourEtParAdresse) return reponse(429, { erreur: "Tu as beaucoup parlé au coach aujourd'hui : reviens demain." });
    await env.LIMITES.put(cle, String(n + 1), { expirationTtl: 172800 });
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  try {
    // Réflexion toujours active sur Fable : on règle la profondeur avec l'effort (« low » pour une
    // conversation). max_tokens couvre la réflexion et la réponse. En cas de refus du modèle, l'API
    // relance la demande sur un modèle de repli (fallbacks).
    const flux = client.beta.messages.stream({
      model: env.COACH_MODELE || "claude-fable-5-2",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: CONSIGNES,
      messages: messagesPourModele(v.demande),
    });
    const message = await flux.finalMessage();
    if (message.stop_reason === "refusal") {
      return reponse(200, { texte: "Je ne peux pas répondre à cette question. Pose-moi une question sur ton entraînement, ta course ou ta nutrition." });
    }
    const texte = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!texte) return reponse(502, { erreur: "Le coach n'a pas répondu : réessaie." });
    return reponse(200, { texte, coupe: message.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reponse(429, { erreur: "Le coach est très demandé : réessaie dans une minute." });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return reponse(503, { erreur: "Le coach est mal configuré (clé refusée)." });
    }
    if (e instanceof Anthropic.BadRequestError) return reponse(502, { erreur: "Le coach n'a pas compris la demande." });
    if (e instanceof Anthropic.APIConnectionError) return reponse(504, { erreur: "Le coach ne répond pas : réessaie." });
    if (e instanceof Anthropic.APIError) return reponse(502, { erreur: "Le coach a un souci technique : réessaie plus tard." });
    throw e;
  }
}
