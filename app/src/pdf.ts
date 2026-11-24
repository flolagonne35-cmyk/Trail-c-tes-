// Export PDF (retour du 24/11 : « sortir les infos en PDF ») : une page HTML mise en forme, imprimée en
// PDF. Web : fenêtre d'impression du navigateur (« Enregistrer au format PDF ») ; téléphone : expo-print
// crée le fichier, puis la feuille de partage l'envoie (mail, WhatsApp, Fichiers…).

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Page complète aux couleurs de l'appli : un titre, un sous-titre, puis le corps HTML fourni. */
export function pageHtml(titre: string, sousTitre: string, corps: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title><style>
    body{font-family:-apple-system,system-ui,"Segoe UI",sans-serif;color:#14231B;margin:28px;font-size:13px;line-height:1.45}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px;color:#1F3D2E}
    .st{color:#5F6A63;margin-bottom:16px}table{border-collapse:collapse;width:100%}
    th,td{border-bottom:1px solid #ECE8DF;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#F6F4EF;font-size:12px}.pied{margin-top:24px;color:#5F6A63;font-size:11px}
    .chiffres{display:flex;gap:18px;flex-wrap:wrap}.chiffres div{background:#F6F4EF;border-radius:10px;padding:8px 12px}
    .chiffres b{display:block;font-size:17px}svg{width:100%;height:auto}
    @media print{body{margin:12mm}}</style></head><body>
    <h1>${echapper(titre)}</h1><div class="st">${echapper(sousTitre)}</div>${corps}
    <div class="pied">Trail-côtes · trail-cotes.pages.dev · ${new Date().toLocaleDateString("fr-FR")}</div></body></html>`;
}

export const cellule = (t: string | number) => `<td>${echapper(String(t))}</td>`;
export const ligneTableau = (cases: (string | number)[]) => `<tr>${cases.map(cellule).join("")}</tr>`;
export const tableau = (entetes: string[], lignes: (string | number)[][]) =>
  `<table><tr>${entetes.map((e) => `<th>${echapper(e)}</th>`).join("")}</tr>${lignes.map(ligneTableau).join("")}</table>`;

/** Profil d'altitude en SVG (pour la page PDF). */
export function profilSvg(d: number[], z: number[]): string {
  if (d.length < 2) return "";
  const L = 700, H = 160, zmin = Math.min(...z), zmax = Math.max(...z), dz = Math.max(zmax - zmin, 1), dm = d[d.length - 1] || 1;
  const pts = d.map((x, i) => `${((x / dm) * L).toFixed(1)},${(10 + (1 - (z[i] - zmin) / dz) * (H - 30)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${L} ${H}" xmlns="http://www.w3.org/2000/svg"><polygon points="0,${H - 20} ${pts} ${L},${H - 20}" fill="#EFECE5"/>`
    + `<polyline points="${pts}" fill="none" stroke="#D9541E" stroke-width="2.5"/>`
    + `<text x="4" y="${H - 4}" font-size="11" fill="#5F6A63">${Math.round(zmin)} m</text>`
    + `<text x="4" y="12" font-size="11" fill="#5F6A63">${Math.round(zmax)} m</text>`
    + `<text x="${L - 4}" y="${H - 4}" font-size="11" fill="#5F6A63" text-anchor="end">${(dm).toFixed(1).replace(".", ",")} km</text></svg>`;
}

export async function exporterPdf(html: string, nomFichier: string): Promise<void> {
  if (Platform.OS === "web") {
    const f = window.open("", "_blank");
    if (!f) return;
    f.document.write(html);
    f.document.close();
    f.focus();
    setTimeout(() => f.print(), 300);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: nomFichier, UTI: "com.adobe.pdf" });
}
