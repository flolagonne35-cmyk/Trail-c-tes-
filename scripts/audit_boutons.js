#!/usr/bin/env node
// Audit de l'interface : sur la version web (format téléphone), ouvre chaque écran et clique
// CHAQUE bouton, onglet, interrupteur et case, un par un (la page est rechargée entre deux
// clics). Pour chacun, on note : erreur de page, effet visible (la page change),
// fichier téléchargé, sélecteur de fichier ou lien ouvert. Un bouton sans aucun effet est signalé.
//
//   EXPO_PUBLIC_TUILES_LOCALES=1 npx expo export --platform web --output-dir <dossier>
//   (servir <dossier> sur http://127.0.0.1:8765/)
//   NODE_PATH=<node_modules avec playwright> node scripts/audit_boutons.js [url] [rapport.json]
//
// Code de sortie 1 si une erreur de page ou un bouton sans effet est trouvé.

const { chromium } = require("playwright");
const fs = require("fs");

const URL_APP = process.argv[2] || "http://127.0.0.1:8765/";
const RAPPORT = process.argv[3] || "audit_boutons.json";
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ROLES = '[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="link"],[role="search"],input[type="checkbox"]';

const attendre = (page, ms = 400) => page.waitForTimeout(ms);

// écrans à auditer : comment y aller depuis l'accueil (profil déjà créé)
const ECRANS = {
  "Accueil": async () => {},
  "Menu": async (p) => { await p.getByRole("button", { name: /^Menu/ }).click(); },
  "Côtes · Montées": async (p) => { await p.getByRole("tab", { name: "Côtes" }).click(); await attendre(p, 1200); },
  "Côtes · Descentes": async (p) => { await ECRANS["Côtes · Montées"](p); await p.getByRole("tab", { name: "Descentes" }).click(); },
  "Côtes · Filtres": async (p) => { await ECRANS["Côtes · Montées"](p); await p.getByRole("button", { name: /^Filtres/ }).click(); },
  "Recherche de lieu": async (p) => { await ECRANS["Côtes · Montées"](p); await p.getByRole("search").click(); },
  "Détail d'une côte": async (p) => { await ECRANS["Côtes · Montées"](p); await p.getByRole("button", { name: /^Côte 1 :/ }).click(); },
  "S'entraîner · Séance": async (p) => { await p.getByRole("tab", { name: "S'entraîner" }).click(); await attendre(p, 1200); },
  "S'entraîner · Boucle": async (p) => {
    await ECRANS["S'entraîner · Séance"](p); await p.getByRole("tab", { name: "Boucle" }).click();
    await p.getByRole("button", { name: "Composer ma boucle" }).click(); await attendre(p, 2500);
  },
  "S'entraîner · Mes progrès": async (p) => { await ECRANS["S'entraîner · Séance"](p); await p.getByRole("tab", { name: "Mes progrès" }).click(); },
  "Course (vide)": async (p) => { await p.getByRole("tab", { name: "Course" }).click(); },
  "Course · Profil": async (p) => { await ECRANS["Course (vide)"](p); await p.getByRole("button", { name: /exemple/ }).click(); },
  "Course · Passages": async (p) => { await ECRANS["Course · Profil"](p); await p.getByRole("tab", { name: "Passages" }).click(); },
  "Course · Prépa": async (p) => { await ECRANS["Course · Profil"](p); await p.getByRole("tab", { name: "Prépa" }).click(); },
  "Nutrition · Durée": async (p) => { await p.getByRole("tab", { name: "Nutrition" }).click(); },
  "Nutrition · Course": async (p) => { await ECRANS["Course · Profil"](p); await p.getByRole("tab", { name: "Nutrition" }).click(); },
  "Mes courses": async (p) => { await ECRANS["Menu"](p); await p.getByRole("button", { name: /^Mes courses\./ }).last().click(); },
  "Mes courses · Formulaire": async (p) => { await ECRANS["Mes courses"](p); await p.getByRole("button", { name: "Ajouter une course" }).click(); },
  "Profil": async (p) => { await p.getByRole("button", { name: "Mon profil" }).first().click(); },
  "Données": async (p) => { await ECRANS["Menu"](p); await p.getByRole("button", { name: /^Données et confidentialité/ }).click(); },
};

async function nouvellePage(nav) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", acceptDownloads: true,
    geolocation: { latitude: 48.1113, longitude: -1.68 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) erreurs.push(m.text()); });
  return { ctx, page, erreurs };
}

(async () => {
  const nav = await chromium.launch({ executablePath: CHROMIUM });
  // profil créé une fois, gardé dans le stockage du navigateur
  const { ctx, page, erreurs } = await nouvellePage(nav);
  await page.goto(URL_APP);
  await attendre(page, 1500);
  await page.getByRole("button", { name: "Plus tard" }).click();
  await attendre(page);
  const etat = await ctx.storageState();
  await ctx.close();

  const resultats = [];
  // AUDIT_ECRANS=regex : seulement certains écrans (pour lancer plusieurs audits en parallèle)
  const filtre = process.env.AUDIT_ECRANS ? new RegExp(process.env.AUDIT_ECRANS) : null;
  for (const [ecran, aller] of Object.entries(ECRANS).filter(([e]) => !filtre || filtre.test(e))) {
    const ouvrir = async () => {
      const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", acceptDownloads: true,
        storageState: etat, geolocation: { latitude: 48.1113, longitude: -1.68 }, permissions: ["geolocation"] });
      const page = await ctx.newPage();
      const erreurs = [];
      page.on("pageerror", (e) => erreurs.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) erreurs.push(m.text()); });
      await page.goto(URL_APP);
      await attendre(page, 1200);
      await aller(page);
      await attendre(page, 3000); // page stable : messages éphémères terminés
      return { ctx, page, erreurs };
    };
    let session = await ouvrir();
    const n = await session.page.locator(ROLES).count();
    const noms = [];
    for (let i = 0; i < n; i++) {
      const el = session.page.locator(ROLES).nth(i);
      noms.push(((await el.getAttribute("aria-label")) || (await el.innerText().catch(() => "")) || "?").replace(/\s+/g, " ").slice(0, 60));
    }
    await session.ctx.close();
    console.log(`\n== ${ecran} : ${n} éléments`);
    for (let i = 0; i < n; i++) {
      session = await ouvrir();
      const { page } = session;
      const el = page.locator(ROLES).nth(i);
      const effets = [];
      page.on("download", (d) => effets.push(`téléchargement ${d.suggestedFilename()}`));
      page.on("filechooser", () => effets.push("sélecteur de fichier"));
      page.on("popup", () => effets.push("lien ouvert"));
      let statut = "ok";
      try {
        await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        const avant = await page.evaluate(() => document.body.innerHTML);
        const desactive = (await el.getAttribute("aria-disabled")) === "true" || (await el.isDisabled());
        const dejaActif = (await el.getAttribute("aria-selected")) === "true"; // onglet ou choix déjà sélectionné
        if (desactive) throw new Error("désactivé");
        // sous un panneau ouvert (menu, formulaire) : volontairement inaccessible
        const masque = await el.evaluate((e) => {
          const r = e.getBoundingClientRect();
          const x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (y < 0 || y > innerHeight) return true; // resté hors écran : son défilement est bloqué par un panneau
          const dessus = document.elementFromPoint(x, y);
          return !!dessus && !e.contains(dessus) && !dessus.contains(e);
        });
        if (masque) throw new Error("masqué");
        await el.click({ timeout: 3000 });
        await attendre(page, 600);
        const apres = await page.evaluate(() => document.body.innerHTML);
        if (avant !== apres) effets.push("page modifiée");
        if (desactive) statut = "désactivé";
        else if (dejaActif && !effets.length) statut = "déjà actif";
        else if (!effets.length) statut = "SANS EFFET";
      } catch (e) {
        if (String(e.message) === "désactivé") statut = "désactivé";
        else if (String(e.message) === "masqué") statut = "sous un panneau";
        else statut = `NON CLIQUABLE (${String(e.message).split("\n")[0].slice(0, 80)})`;
      }
      if (session.erreurs.length) statut = `ERREUR : ${session.erreurs[0].slice(0, 120)}`;
      resultats.push({ ecran, i, nom: noms[i], statut, effets });
      console.log(`  ${statut === "ok" ? "✓" : "✗"} ${noms[i]} — ${statut}${effets.length ? ` (${effets.join(", ")})` : ""}`);
      await session.ctx.close();
    }
  }
  await nav.close();
  fs.writeFileSync(RAPPORT, JSON.stringify(resultats, null, 2));
  const problemes = resultats.filter((r) => !["ok", "désactivé", "déjà actif", "sous un panneau"].includes(r.statut));
  console.log(`\n${resultats.length} éléments cliqués, ${problemes.length} problème(s)${erreurs.length ? `, erreurs au démarrage : ${erreurs}` : ""}`);
  process.exit(problemes.length ? 1 : 0);
})();
