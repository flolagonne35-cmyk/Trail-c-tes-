// Lecture d'une capture d'écran (Cloudflare Pages Functions) : POST /api/capture { type, image }.
// Modèle de vision ouvert hébergé par Cloudflare (Workers AI) : Mistral Small 3.1 (licence Apache 2.0,
// pas de licence à accepter), dans la limite gratuite partagée avec le coach. L'image n'est ni gardée
// ni journalisée par la fonction ; Workers AI ne conserve pas les données de ce modèle.

import { CONSIGNES_CAPTURE, extraireJson, lireActivite, lireProfil, type TypeCapture } from "../../src/calcul/capture.ts";
import { texteDe } from "./coach.ts";

type IA = { run(modele: string, entree: Record<string, unknown>): Promise<unknown> };
type Env = { AI?: IA };

export const MODELE_VISION = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const ENTETES = { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store" };
const reponse = (statut: number, corps: Record<string, unknown>) => new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

export const onRequestOptions = () => new Response(null, { status: 204, headers: ENTETES });

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!env.AI) return reponse(503, { erreur: "La lecture des captures n'est pas disponible." });
  // image réduite par l'appli (1 280 px, JPEG) : 3 Mo suffisent largement
  if (Number(request.headers.get("content-length") ?? 0) > 3_000_000) return reponse(413, { erreur: "Image trop lourde." });
  let corps: { type?: unknown; image?: unknown };
  try { corps = await request.json(); } catch { return reponse(400, { erreur: "Demande illisible." }); }
  const type = corps.type === "profil" ? "profil" : corps.type === "activite" ? "activite" : null;
  if (!type || typeof corps.image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(corps.image)) {
    return reponse(400, { erreur: "Il faut une image (JPEG, PNG ou WebP)." });
  }
  try {
    const r = await env.AI.run(MODELE_VISION, {
      messages: [{ role: "system", content: CONSIGNES_CAPTURE[type as TypeCapture] },
                 { role: "user", content: [{ type: "text", text: "Lis cette capture et réponds en JSON." }, { type: "image_url", image_url: { url: corps.image } }] }],
      max_tokens: 900, temperature: 0.1,
    });
    const j = extraireJson(texteDe(r));
    if (!j) return reponse(422, { erreur: "Je n'ai pas réussi à lire cette capture : essaie une image plus nette ou recadrée." });
    return reponse(200, { lecture: type === "profil" ? lireProfil(j) : lireActivite(j) });
  } catch {
    return reponse(503, { erreur: "Lecture indisponible pour le moment (quota gratuit du jour atteint ?). Réessaie plus tard ou saisis les chiffres." });
  }
}
