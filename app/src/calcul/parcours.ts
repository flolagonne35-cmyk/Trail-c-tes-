// GPX → parcours segmenté : même chaîne que scripts/segmenter_gpx.py (pas de 10 m, lissage 30 m).

import { boucher, analyserProfil, lisser, type Parcours } from "./profil.ts";
import { interp, longueursCumulees, projection, reechantillonner } from "./geo.ts";
import { lireGpx } from "./gpx.ts";
import { altitudesIgn, type Progression } from "./ign.ts";

export const PAS_M = 10;
export const LISSAGE_M = 30;

export type Altitudes = (lat: number[], lon: number[], onProgres?: Progression) => Promise<(number | null)[]>;

export async function analyserGpx(texte: string, options: { altitudes?: Altitudes | null; onProgres?: Progression;
                                                               nom?: string } = {}): Promise<Parcours> {
  const trace = lireGpx(texte, options.nom);
  const lat0 = trace.lat.reduce((a, b) => a + b, 0) / trace.lat.length;
  const lon0 = trace.lon.reduce((a, b) => a + b, 0) / trace.lon.length;
  const proj = projection(lat0, lon0);
  const x: number[] = [];
  const y: number[] = [];
  const ele: (number | null)[] = [];
  trace.lat.forEach((la, i) => {
    const [px, py] = proj.xy(la, trace.lon[i]);
    if (x.length && Math.hypot(px - x[x.length - 1], py - y[y.length - 1]) <= 0.01) return; // point répété
    x.push(px);
    y.push(py);
    ele.push(trace.ele[i]);
  });
  if (x.length < 2) throw new Error("Trace trop courte.");
  const r = reechantillonner(x, y, PAS_M);
  const c = longueursCumulees(x, y);
  const eleGpx = boucher(c, ele);
  const zGpx: (number | null)[] = eleGpx ? r.d.map((s) => interp(s, c, eleGpx)) : r.d.map(() => null);

  let zBrut: (number | null)[] = zGpx;
  let source = "GPX";
  const altitudes = options.altitudes === undefined ? altitudesIgn : options.altitudes;
  if (altitudes) {
    try {
      const pts = r.x.map((px, i) => proj.latlon(px, r.y[i]));
      const zIgn = await altitudes(pts.map((p) => p.lat), pts.map((p) => p.lon), options.onProgres);
      if (zIgn.filter((v) => v === null).length / zIgn.length <= 0.05) {
        zBrut = zIgn;
        source = "IGN RGE ALTI";
      } else {
        source = "GPX (repli : altitudes IGN incomplètes)";
      }
    } catch {
      source = "GPX (repli : service IGN injoignable)";
    }
  }
  const z = boucher(r.d, zBrut);
  if (!z) throw new Error("Aucune altitude : le GPX n'en contient pas et le service IGN ne répond pas.");
  return analyserProfil(trace.nom, r.d, lisser(z, LISSAGE_M / PAS_M), source);
}
