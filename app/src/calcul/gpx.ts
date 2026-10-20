// Lecture et écriture GPX sans dépendance (React Native n'a pas de DOMParser).

/** temps : instant de chaque point en millisecondes (null si le GPX n'est pas horodaté) ;
 *  fc : fréquence cardiaque (extension Garmin TrackPointExtension, reprise par Strava, Coros, Suunto). */
export type TraceGpx = {
  nom: string; lat: number[]; lon: number[]; ele: (number | null)[]; temps: (number | null)[]; fc: (number | null)[];
};

const attribut = (attrs: string, nom: string) => {
  const m = attrs.match(new RegExp(`\\b${nom}\\s*=\\s*["']([^"']+)["']`));
  return m ? parseFloat(m[1]) : NaN;
};

const decoder = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

export function lireGpx(texte: string, nomParDefaut = "Parcours"): TraceGpx {
  const lat: number[] = [];
  const lon: number[] = [];
  const ele: (number | null)[] = [];
  const temps: (number | null)[] = [];
  const fc: (number | null)[] = [];
  for (const balise of ["trkpt", "rtept"]) {
    const re = new RegExp(`<(?:\\w+:)?${balise}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${balise}>)`, "g");
    for (const m of texte.matchAll(re)) {
      const la = attribut(m[1], "lat");
      const lo = attribut(m[1], "lon");
      if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
      const e = m[2]?.match(/<(?:\w+:)?ele>\s*([^<]+?)\s*</);
      lat.push(la);
      lon.push(lo);
      ele.push(e ? parseFloat(e[1]) : null);
      const t = m[2]?.match(/<(?:\w+:)?time>\s*([^<]+?)\s*</);
      const ms = t ? Date.parse(t[1]) : NaN;
      temps.push(Number.isFinite(ms) ? ms : null);
      const h = m[2]?.match(/<(?:\w+:)?(?:hr|heartrate)>\s*(\d+)/);
      fc.push(h ? parseInt(h[1], 10) : null);
    }
    if (lat.length) break; // les points de trace priment sur ceux de route
  }
  if (!lat.length) throw new Error("Aucun point de trace (trkpt) ni de route (rtept) dans ce GPX.");
  const nom = texte.match(/<(?:\w+:)?name>\s*(?:<!\[CDATA\[)?([^<\]]+)/);
  return { nom: nom ? decoder(nom[1].trim()) : nomParDefaut, lat, lon, ele, temps, fc };
}

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ecrireGpx(nom: string, points: { lat: number; lon: number; ele?: number; temps?: number; fc?: number }[]): string {
  const pts = points
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">` +
      (p.ele !== undefined ? `<ele>${p.ele.toFixed(1)}</ele>` : "") +
      (p.temps !== undefined ? `<time>${new Date(p.temps).toISOString()}</time>` : "") +
      (p.fc !== undefined ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(p.fc)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : "") +
      "</trkpt>")
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="trail-cotes" xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>${echapper(nom)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
