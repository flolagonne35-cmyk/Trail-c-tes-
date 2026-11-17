// Fonction serveur du coach (Cloudflare Pages Functions) : POST /api/coach.
// Sans clé ni abonnement : elle utilise Workers AI, les modèles ouverts hébergés par Cloudflare
// (binding « AI » déclaré dans wrangler.toml), dans la limite gratuite de 10 000 neurones par jour.
// Quota du jour épuisé, modèle indisponible ou binding absent : elle répond 503 et l'appli se
// rabat sur son coach intégré (src/calcul/coachIntegre.ts). Aucun coût possible sur l'offre gratuite.
// Facultatif : un espace KV « LIMITES » borne le nombre de messages par jour et par adresse.

import { CONSIGNES, LIMITES, messagesPourModele, validerDemande } from "../../src/calcul/coach.ts";

type KV = { get(cle: string): Promise<string | null>; put(cle: string, valeur: string, options?: { expirationTtl?: number }): Promise<void> };
type IA = { run(modele: string, entree: Record<string, unknown>): Promise<unknown> };
type Env = { AI?: IA; COACH_MODELES?: string; LIMITES?: KV };
type Contexte = { request: Request; env: Env };

/** Modèles essayés dans l'ordre : ouverts, bons en français, disponibles sur l'offre gratuite. */
export const MODELES = ["@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"];

const ENTETES = {
  "Content-Type": "application/json; charset=utf-8",
  // l'appli installée (Android, iPhone) appelle depuis une autre origine que le site
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};
const reponse = (statut: number, corps: Record<string, unknown>) => new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

/** Texte d'une réponse Workers AI : `{ response }` (format historique) ou `{ choices: [{ message }] }`. */
export function texteDe(r: unknown): string {
  const x = r as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null;
  const t = typeof x?.response === "string" ? x.response : x?.choices?.[0]?.message?.content;
  return typeof t === "string" ? t.trim() : "";
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: ENTETES });

export async function onRequestPost({ request, env }: Contexte): Promise<Response> {
  if (!env.AI) return reponse(503, { erreur: "Le coach en ligne n'est pas disponible.", repli: true });
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

  // limite par jour et par adresse, si l'espace KV est branché : le quota gratuit se partage entre tous
  if (env.LIMITES) {
    const cle = `coach:${new Date().toISOString().slice(0, 10)}:${request.headers.get("cf-connecting-ip") ?? "inconnu"}`;
    const n = Number((await env.LIMITES.get(cle)) ?? 0);
    if (n >= LIMITES.parJourEtParAdresse) return reponse(429, { erreur: "Tu as beaucoup parlé au coach en ligne aujourd'hui.", repli: true });
    await env.LIMITES.put(cle, String(n + 1), { expirationTtl: 172800 });
  }

  const messages = [{ role: "system", content: CONSIGNES }, ...messagesPourModele(v.demande)];
  const modeles = env.COACH_MODELES ? env.COACH_MODELES.split(",").map((m) => m.trim()).filter(Boolean) : MODELES;
  for (const modele of modeles) {
    try {
      const texte = texteDe(await env.AI.run(modele, { messages, max_tokens: 700, temperature: 0.4 }));
      if (texte) return reponse(200, { texte, modele });
    } catch {
      // quota du jour épuisé, modèle saturé ou retiré : on essaie le suivant
    }
  }
  return reponse(503, { erreur: "Le coach en ligne a épuisé son quota gratuit du jour.", repli: true });
}
