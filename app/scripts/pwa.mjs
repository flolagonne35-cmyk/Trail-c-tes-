// Après `expo export --platform web` : rend l'appli installable sur l'écran d'accueil (PWA).
// Le manifeste et les icônes sont dans public/ (copiés tels quels dans dist/) ; on ajoute ici
// les balises qui les déclarent, pour Android (manifeste) et pour l'iPhone (apple-touch-icon).
import { readFileSync, writeFileSync } from "node:fs";

const fichier = process.argv[2] ?? "dist/index.html";
const balises = '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png">'
  + '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Trail-côtes">'
  + '<meta name="theme-color" content="#1B2A22">';
const html = readFileSync(fichier, "utf8");
if (!html.includes("manifest.webmanifest")) writeFileSync(fichier, html.replace("</head>", `${balises}</head>`));
console.log("PWA : balises ajoutées à", fichier);
