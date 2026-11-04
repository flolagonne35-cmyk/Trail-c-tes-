// Service worker de la version web (PWA) : l'appli s'ouvre et reste utilisable sans réseau.
//
// - Appli (page, code, icônes) : gardée à la première visite. La page est demandée au réseau
//   d'abord (nouvelle version dès qu'il y a du réseau), sinon lue dans le cache.
// - Données (/cotes/, /reseau/, /eau/) : réseau d'abord, copie gardée ; sans réseau, la copie sert.
//   Les zones gardées exprès (« Garder cette zone hors connexion ») sont dans un cache à part,
//   jamais vidé automatiquement.
// - Carte Plan IGN (data.geopf.fr) : cache d'abord (les tuiles changent rarement), nombre limité.
//
// Référence : https://developer.mozilla.org/fr/docs/Web/API/Service_Worker_API (stratégies de cache)

const VERSION = "v1";
const APPLI = `appli-${VERSION}`;
const DONNEES = "donnees";
const CARTE = "carte";
// cache « zones-gardees » : écrit par la page (src/zoneHorsLigne.ts), lu ici via caches.match
const MAX_DONNEES = 400; // fichiers de données gardés automatiquement (les plus anciens partent)
const MAX_CARTE = 3000; // tuiles gardées automatiquement (≈ 150 Mo au plus)

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APPLI).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icone-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((k) => k.startsWith("appli-") && k !== APPLI).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function limiter(nom, max) {
  const c = await caches.open(nom);
  const cles = await c.keys();
  for (const k of cles.slice(0, Math.max(0, cles.length - max))) await c.delete(k);
}

async function reseauDabord(req, nom, repli) {
  try {
    const r = await fetch(req);
    if (r.ok) {
      const copie = r.clone();
      caches.open(nom).then((c) => c.put(req, copie)).then(() => nom === DONNEES && limiter(DONNEES, MAX_DONNEES));
    }
    return r;
  } catch {
    return (await caches.match(req)) ?? (repli && (await caches.match(repli))) ?? Response.error();
  }
}

async function cacheDabord(req, nom) {
  const garde = await caches.match(req);
  if (garde) return garde;
  const r = await fetch(req);
  if (r.ok) caches.open(nom).then((c) => c.put(req, r.clone()));
  return r;
}

// tuile Plan IGN : demandée en CORS pour garder une vraie réponse (une réponse « opaque » compte
// pour plusieurs Mo dans le quota du navigateur) ; si le serveur refuse, la tuile s'affiche sans être gardée
async function tuile(req) {
  const garde = await caches.match(req.url);
  if (garde) return garde;
  try {
    const r = await fetch(req.url, { mode: "cors" });
    if (r.ok) {
      const c = await caches.open(CARTE);
      await c.put(req.url, r.clone());
      limiter(CARTE, MAX_CARTE);
    }
    return r;
  } catch {
    return fetch(req);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") e.respondWith(reseauDabord(req, APPLI, "/"));
    else if (/^\/(cotes|reseau|eau)\//.test(url.pathname)) e.respondWith(reseauDabord(req, DONNEES));
    else if (url.pathname !== "/sw.js") e.respondWith(cacheDabord(req, APPLI));
  } else if (url.hostname === "data.geopf.fr" && url.pathname.startsWith("/wmts")) {
    e.respondWith(tuile(req));
  }
});
