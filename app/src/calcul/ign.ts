// Altitudes IGN (RGE ALTI) via le service de calcul altimétrique de la Géoplateforme.
// Mêmes réglages que trailcotes/ign.py, vérifiés sur le service réel : GET par lots de 150 points
// (au-delà de ~330 points l'URL est refusée), 6 décimales.

const API = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
const NODATA = -99999;

export type Progression = (fait: number, total: number) => void;

export async function altitudesIgn(lat: number[], lon: number[], onProgres?: Progression,
                                   tailleLot = 150, essais = 3): Promise<(number | null)[]> {
  const z: (number | null)[] = new Array(lat.length).fill(null);
  for (let debut = 0; debut < lat.length; debut += tailleLot) {
    const fin = Math.min(debut + tailleLot, lat.length);
    const params = new URLSearchParams({
      lon: lon.slice(debut, fin).map((v) => v.toFixed(6)).join("|"),
      lat: lat.slice(debut, fin).map((v) => v.toFixed(6)).join("|"),
      resource: "ign_rge_alti_wld",
      delimiter: "|",
      indent: "false",
      measures: "false",
      zonly: "true",
    });
    for (let essai = 0; essai < essais; essai++) {
      try {
        const r = await fetch(`${API}?${params}`);
        if (r.ok) {
          const json = await r.json();
          const elev: unknown[] = json.elevations ?? [];
          if (elev.length !== fin - debut) throw new Error(`${elev.length} altitudes pour ${fin - debut} points`);
          elev.forEach((e, k) => {
            const v = typeof e === "number" ? e : Number((e as { z?: number }).z);
            z[debut + k] = Number.isFinite(v) && v > NODATA + 1 ? v : null;
          });
          break;
        }
        if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status}`);
      } catch (e) {
        if (essai === essais - 1) throw e;
      }
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** essai));
    }
    onProgres?.(fin, lat.length);
  }
  return z;
}
