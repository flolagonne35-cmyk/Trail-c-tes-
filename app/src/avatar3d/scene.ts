// Scène three.js de l'avatar : le corps MakeHuman habillé par zones (couleurs par sommet), et les
// accessoires construits en géométrie simple, placés sur le corps déformé : casquette, visière ou
// bandeau, coiffures (queue de cheval, chignon, cheveux longs), lunettes, bâtons, frontale,
// flasques du gilet, montre. Chaque accessoire est accroché à un os : il suit la pose de course.
// Commun au web et au téléphone (le rendu passe par expo-gl dans Avatar3D.tsx).

import * as THREE from "three";

import { CHEVEUX, couleurZone, morphoser, pivotsMorphoses, poidsCibles, TISSUS, type Corps, type DonneesCorps } from "./corps.ts";
import { matricesOs, poser, rotationsPose, type Pose } from "./pose.ts";
import { vetementsDe } from "./vetements.ts";

const DM = 0.1; // MakeHuman travaille en décimètres ; la scène en mètres

type Reperes = {
  tete: THREE.Vector3; rayonTete: number; hautTete: number; front: THREE.Vector3;
  yeux: THREE.Vector3; oeilG: THREE.Vector3; oeilD: THREE.Vector3; mainG: THREE.Vector3; mainD: THREE.Vector3; poignetG: THREE.Vector3; sol: number; hauteur: number;
};

/** Repères calculés sur le corps déformé, à partir des zones (centres de la tête, des mains…). */
function reperes(pos: Float32Array, d: DonneesCorps): Reperes {
  const z = (nom: string) => d.zones.indexOf(nom);
  const acc = new Map<string, { s: THREE.Vector3; n: number; ymax: number; ymin: number; zmax: number }>();
  let sol = Infinity;
  let haut = -Infinity;
  for (let i = 0; i < d.sommets; i++) {
    const x = pos[i * 3] * DM, y = pos[i * 3 + 1] * DM, zz = pos[i * 3 + 2] * DM;
    sol = Math.min(sol, y);
    haut = Math.max(haut, y);
    const zone = d.zoneDe[i];
    const cote = zone === z("main") || zone === z("avant_bras") || zone === z("oeil_blanc") || zone === z("iris") || zone === z("pupille");
    const cle = cote ? `${d.zones[zone]}${x >= 0 ? "G" : "D"}` : d.zones[zone];
    const a = acc.get(cle) ?? { s: new THREE.Vector3(), n: 0, ymax: -Infinity, ymin: Infinity, zmax: -Infinity };
    a.s.add(new THREE.Vector3(x, y, zz)); a.n++; a.ymax = Math.max(a.ymax, y); a.ymin = Math.min(a.ymin, y); a.zmax = Math.max(a.zmax, zz);
    acc.set(cle, a);
  }
  const c = (cle: string) => { const a = acc.get(cle); return a ? a.s.clone().divideScalar(a.n) : new THREE.Vector3(); };
  const crane = acc.get("crane")!;
  const visage = acc.get("visage")!;
  const centreTete = c("visage").lerp(c("crane"), 0.5);
  const rayonTete = (crane.ymax - visage.ymin) * 0.42;
  const oeilG = c("oeil_blancG"), oeilD = c("oeil_blancD");
  const yeux = oeilG.clone().lerp(oeilD, 0.5);
  return {
    tete: centreTete, rayonTete, hautTete: crane.ymax, front: new THREE.Vector3(0, yeux.y + rayonTete * 0.35, visage.zmax - rayonTete * 0.15),
    yeux, oeilG, oeilD, mainG: c("mainG"), mainD: c("mainD"),
    poignetG: c("avant_brasG").lerp(c("mainG"), 0.72), sol, hauteur: haut - sol,
  };
}

const matiere = (couleur: string, rugosite = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: couleur, roughness: rugosite, metalness: metal });

/** Accessoires selon la tenue et l'équipement porté. */
type Accroche = "tete" | "poitrine" | "mainG" | "mainD" | "avantbrasG";
function accessoires(c: Corps, r: Reperes): [Accroche, THREE.Object3D][] {
  const liste: [Accroche, THREE.Object3D][] = [];
  const sur = (os: Accroche) => ({ push: (...o: THREE.Object3D[]) => o.forEach((x) => liste.push([os, x])) });
  const objets = sur("tete");
  const tissuTete = TISSUS[c.couleurTete]?.[0] ?? TISSUS[4][0];
  const R = r.rayonTete;
  if (c.tete === "casquette") {
    const calotte = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), matiere(tissuTete, 0.85));
    calotte.position.set(r.tete.x, r.hautTete - R * 1.0, r.tete.z - R * 0.08);
    const visiere = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.78, R * 0.05, 32, 1, false, -Math.PI * 0.42, Math.PI * 0.84), matiere(tissuTete, 0.85));
    visiere.position.set(r.tete.x, r.hautTete - R * 0.58, r.tete.z + R * 0.62);
    visiere.rotation.x = 0.12;
    objets.push(calotte, visiere);
  } else if (c.tete === "visiere") {
    const bande = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, R * 0.09, 10, 40), matiere(tissuTete, 0.85));
    bande.rotation.x = Math.PI / 2 - 0.15;
    bande.position.set(r.tete.x, r.hautTete - R * 0.62, r.tete.z);
    const visiere = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, R * 0.05, 32, 1, false, -Math.PI * 0.42, Math.PI * 0.84), matiere(tissuTete, 0.85));
    visiere.position.set(r.tete.x, r.hautTete - R * 0.62, r.tete.z + R * 0.6);
    objets.push(bande, visiere);
  } else if (c.tete === "bandeau") {
    const bande = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.14, 10, 40), matiere(tissuTete, 0.9));
    bande.rotation.x = Math.PI / 2 - 0.2;
    bande.position.set(r.tete.x, r.hautTete - R * 0.55, r.tete.z);
    objets.push(bande);
  }
  const couleurCheveux = CHEVEUX[c.cheveux]?.[0] ?? CHEVEUX[1][0];
  if (c.coupe === "attaches") {
    const queue = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.2, R * 0.95, 6, 14), matiere(couleurCheveux, 0.6));
    queue.position.set(r.tete.x, r.tete.y - R * 0.15, r.tete.z - R * 1.05);
    queue.rotation.x = 0.35;
    const elastique = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, R * 0.05, 8, 20), matiere(TISSUS[0][0], 0.6));
    elastique.position.set(r.tete.x, r.tete.y + R * 0.38, r.tete.z - R * 0.88);
    elastique.rotation.x = Math.PI / 2 + 0.35;
    objets.push(queue, elastique);
  } else if (c.coupe === "chignon") {
    const chignon = new THREE.Mesh(new THREE.SphereGeometry(R * 0.36, 20, 14), matiere(couleurCheveux, 0.65));
    chignon.position.set(r.tete.x, r.tete.y + R * 0.45, r.tete.z - R * 1.02);
    objets.push(chignon);
  } else if (c.coupe === "longs") {
    // cheveux longs : une nappe derrière la tête qui descend jusqu'aux épaules
    // (three.js : l'angle phi part de -x et tourne vers +z ; l'arrière de la tête est autour de phi = 1,5 π)
    const nappe = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 28, 18, Math.PI * 0.92, Math.PI * 1.16, 0.08 * Math.PI, 0.6 * Math.PI),
                                 matiere(couleurCheveux, 0.65));
    nappe.material.side = THREE.DoubleSide;
    nappe.scale.set(1.02, 1.75, 0.95);
    nappe.position.set(r.tete.x, r.tete.y - R * 0.55, r.tete.z - R * 0.12);
    objets.push(nappe);
  }
  if (c.lunettes) {
    const verreMat = new THREE.MeshStandardMaterial({ color: "#20262B", roughness: 0.08, metalness: 0.85, envMapIntensity: 1 });
    const monture = matiere("#151515", 0.4);
    const ecart = r.oeilG.distanceTo(r.oeilD);
    for (const oeil of [r.oeilG, r.oeilD]) {
      const verre = new THREE.Mesh(new THREE.SphereGeometry(ecart * 0.42, 24, 12), verreMat);
      verre.scale.set(1.15, 0.62, 0.28);
      verre.position.copy(oeil).add(new THREE.Vector3(0, ecart * 0.02, ecart * 0.38));
      objets.push(verre);
    }
    const pont = new THREE.Mesh(new THREE.BoxGeometry(ecart * 0.3, ecart * 0.07, ecart * 0.07), monture);
    pont.position.copy(r.yeux).add(new THREE.Vector3(0, ecart * 0.12, ecart * 0.5));
    objets.push(pont);
    for (const [oeil, sens] of [[r.oeilG, 1], [r.oeilD, -1]] as const) {
      const branche = new THREE.Mesh(new THREE.BoxGeometry(ecart * 0.05, ecart * 0.06, R * 1.0), monture);
      branche.position.copy(oeil).add(new THREE.Vector3(sens * ecart * 0.42, ecart * 0.06, -R * 0.2));
      objets.push(branche);
    }
  }
  if (c.equipement.includes("frontale-lumen")) {
    const sangle = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.07, 8, 40), matiere("#1E2326", 0.7));
    sangle.rotation.x = Math.PI / 2 - 0.12;
    sangle.position.set(r.tete.x, r.front.y + R * 0.08, r.tete.z);
    objets.push(sangle);
    const lampe = new THREE.Mesh(new THREE.BoxGeometry(R * 0.42, R * 0.26, R * 0.2), matiere("#2B2F31", 0.4));
    lampe.position.copy(r.front).add(new THREE.Vector3(0, R * 0.1, R * 0.12));
    const verre = new THREE.Mesh(new THREE.CircleGeometry(R * 0.09, 20), new THREE.MeshStandardMaterial({ color: "#FFF6D8", emissive: "#FFE9A8", emissiveIntensity: 0.9 }));
    verre.position.copy(lampe.position).add(new THREE.Vector3(0, 0, R * 0.105));
    objets.push(lampe, verre);
  }
  if (c.equipement.includes("batons-cretal")) {
    for (const [main, os] of [[r.mainG, "mainG"], [r.mainD, "mainD"]] as const) {
      const bas = new THREE.Vector3(main.x * 1.25, r.sol, main.z + 0.12);
      const haut = main.clone().add(new THREE.Vector3(0, 0.05, 0));
      const long = haut.distanceTo(bas);
      const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, long, 10), matiere("#1C1C1C", 0.3, 0.4));
      baton.position.copy(haut).add(bas).multiplyScalar(0.5);
      baton.lookAt(bas);
      baton.rotateX(Math.PI / 2);
      const poignee = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.12, 12), matiere("#E8572A", 0.6));
      poignee.position.copy(haut);
      poignee.quaternion.copy(baton.quaternion);
      sur(os).push(baton, poignee);
    }
  }
  if (c.equipement.includes("gilet-givre") || c.equipement.includes("gilet-everest")) {
    for (const cote of [-1, 1]) {
      const flasque = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.08, 6, 12), new THREE.MeshStandardMaterial({ color: "#CFE3EE", roughness: 0.2, transparent: true, opacity: 0.85 }));
      flasque.position.set(cote * 0.085, r.tete.y - r.rayonTete * 3.2, r.tete.z + r.rayonTete * 1.05);
      sur("poitrine").push(flasque);
    }
  }
  if (c.equipement.includes("montre-cadran")) {
    const montre = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.009, 8, 20), matiere("#111", 0.4, 0.3));
    montre.position.copy(r.poignetG);
    montre.lookAt(r.mainG);
    sur("avantbrasG").push(montre);
  }
  return liste;
}

export type Rendu = {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; pivot: THREE.Group; regler: (c: Corps) => void; hauteur: () => number;
  /** pose (debout ou en course) ; `phase` : instant du cycle de course, en radians */
  poser: (pose: Pose, phase?: number) => void;
};

/** Construit la scène pour un coureur ; `regler` la met à jour quand un réglage change. */
export function creerScene(d: DonneesCorps, c0: Corps, aspect: number): Rendu {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, aspect, 0.05, 20);
  scene.add(new THREE.HemisphereLight("#FFFFFF", "#5A5048", 1.1));
  const soleil = new THREE.DirectionalLight("#FFF1E0", 2.0);
  soleil.position.set(1.4, 2.6, 2.4);
  scene.add(soleil);
  const contre = new THREE.DirectionalLight("#BFD8FF", 1.0);
  contre.position.set(-2, 1.5, -2.5);
  scene.add(contre);

  const pivot = new THREE.Group();
  scene.add(pivot);
  const geo = new THREE.BufferGeometry();
  const repos = new Float32Array(d.positions.length); // corps réglé, au repos (bras en « A »)
  const positions = new Float32Array(d.positions.length); // corps posé, affiché
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(d.positions.length), 3));
  geo.setIndex(new THREE.BufferAttribute(d.indices, 1));
  const corps = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 }));
  corps.scale.setScalar(DM);
  pivot.add(corps);
  // ombre de contact sous les pieds
  const ombre = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.12 }));
  ombre.rotation.x = -Math.PI / 2;
  scene.add(ombre);

  // un groupe par os qui porte des accessoires ; sa matrice suit l'os (repère en mètres)
  const accroches = new Map<string, THREE.Group>();
  for (const nom of ["tete", "poitrine", "mainG", "mainD", "avantbrasG"]) {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    pivot.add(g);
    accroches.set(nom, g);
  }
  const echelle = new THREE.Matrix4().makeScale(DM, DM, DM);
  const echelleInv = new THREE.Matrix4().makeScale(1 / DM, 1 / DM, 1 / DM);
  let pivotsOs: Float32Array = new Float32Array(d.pivots);
  let poseActuelle: Pose = "debout";
  let phaseActuelle = Math.PI / 2;

  // vêtements en relief : une géométrie par pièce, mise à jour à chaque pose depuis le corps posé
  type Habit = { geo: THREE.BufferGeometry; mesh: THREE.Mesh; membres: Int32Array; epaisseur: number };
  let habits: Habit[] = [];
  const majHabits = () => {
    const normales = geo.attributes.normal.array as Float32Array;
    for (const h of habits) {
      const p = h.geo.attributes.position.array as Float32Array;
      for (const i of h.membres) {
        for (let k = 0; k < 3; k++) p[i * 3 + k] = positions[i * 3 + k] + normales[i * 3 + k] * h.epaisseur;
      }
      h.geo.attributes.position.needsUpdate = true;
      h.geo.computeVertexNormals();
    }
  };

  let hauteur = 1.7;
  const poserCorps = (pose: Pose, phase = phaseActuelle) => {
    poseActuelle = pose;
    phaseActuelle = phase;
    if (!d.os.length) { positions.set(repos); geo.computeVertexNormals(); majHabits(); return; }
    const m = matricesOs(d, pivotsOs, rotationsPose(d, pivotsOs, pose, phase));
    const bas = poser(d, repos, m, positions);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    majHabits();
    for (const [nom, g] of accroches) {
      const i = d.os.findIndex((o) => o.nom === nom);
      if (i >= 0) g.matrix.copy(echelle).multiply(m[i]).multiply(echelleInv);
    }
    pivot.position.y = -bas * DM; // les pieds touchent le sol à chaque instant de la foulée
  };

  const regler = (c: Corps) => {
    const poids = poidsCibles(c, d.nomsCibles);
    morphoser(d, poids, repos);
    if (d.os.length) pivotsOs = pivotsMorphoses(d, poids);
    // épaisseur de la chaussure et volume de la barbe : le maillage est « gonflé » le long de ses normales
    positions.set(repos);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    const pied = d.zones.indexOf("pied");
    const barbe = d.zones.indexOf("barbe");
    const epaisseurBarbe = c.barbe === "fournie" ? 0.05 : c.barbe === "courte" ? 0.015 : 0;
    const normales = geo.attributes.normal.array as Float32Array;
    for (let i = 0; i < d.sommets; i++) {
      const e = d.zoneDe[i] === pied ? 0.11 : d.zoneDe[i] === barbe ? epaisseurBarbe : 0; // 1 cm de chaussure
      if (!e) continue;
      for (let k = 0; k < 3; k++) repos[i * 3 + k] += normales[i * 3 + k] * e;
    }
    positions.set(repos);
    geo.computeVertexNormals();
    // couleurs par zone (semelle plus sombre : les sommets les plus bas du pied)
    const couleurs = geo.attributes.color.array as Float32Array;
    const parZone = d.zones.map((z) => new THREE.Color(couleurZone(z, c)).convertSRGBToLinear());
    let sol = Infinity;
    for (let i = 1; i < positions.length; i += 3) sol = Math.min(sol, positions[i]);
    const semelle = new THREE.Color("#F2F0EB").convertSRGBToLinear();
    // chaussure : semelle claire, bande latérale contrastée (comme les renforts des chaussures de trail)
    const nChaussure = geo.attributes.normal.array as Float32Array;
    const bande = new THREE.Color(c.couleurChaussures === 4 ? "#E8572A" : "#F2F0EB").convertSRGBToLinear();
    for (let i = 0; i < d.sommets; i++) {
      const y = positions[i * 3 + 1];
      const col = d.zoneDe[i] === pied && y < sol + 0.22 ? semelle
        : d.zoneDe[i] === pied && Math.abs(nChaussure[i * 3]) > 0.7 && y < sol + 0.55 ? bande : parZone[d.zoneDe[i]];
      couleurs[i * 3] = col.r; couleurs[i * 3 + 1] = col.g; couleurs[i * 3 + 2] = col.b;
    }
    geo.attributes.color.needsUpdate = true;

    // vêtements : sommets de la pièce, triangles entièrement dedans, ourlet (bord), panneaux et logo
    for (const h of habits) { pivot.remove(h.mesh); h.geo.dispose(); (h.mesh.material as THREE.Material).dispose(); }
    habits = [];
    const nrm = geo.attributes.normal.array as Float32Array;
    const torseHaut = d.zones.indexOf("torse_haut");
    let yMin = Infinity, yMax = -Infinity;
    for (let i = 0; i < d.sommets; i++) if (d.zoneDe[i] === torseHaut) { yMin = Math.min(yMin, repos[i * 3 + 1]); yMax = Math.max(yMax, repos[i * 3 + 1]); }
    for (const v of vetementsDe(c)) {
      const zonesV = new Set(v.zones.map((z) => d.zones.indexOf(z)));
      const dans = new Uint8Array(d.sommets);
      for (let i = 0; i < d.sommets; i++) {
        if (!zonesV.has(d.zoneDe[i])) continue;
        // gilet : ouvert devant, sur le sternum
        if (v.ouvertDevant && nrm[i * 3 + 2] > 0.55 && Math.abs(repos[i * 3]) < 0.38) continue;
        dans[i] = 1;
      }
      const tri: number[] = [];
      const bord = new Uint8Array(d.sommets);
      for (let t = 0; t < d.indices.length; t += 3) {
        const a = d.indices[t], b = d.indices[t + 1], e = d.indices[t + 2];
        const n = dans[a] + dans[b] + dans[e];
        if (n === 3) tri.push(a, b, e);
        else if (n > 0) { bord[a] = dans[a]; bord[b] = dans[b]; bord[e] = dans[e]; }
      }
      if (!tri.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(d.sommets * 3), 3));
      const col = new Float32Array(d.sommets * 3);
      const [cBase, cAccent, cOurlet] = [v.base, v.accent, v.ourlet].map((x) => new THREE.Color(x).convertSRGBToLinear());
      const brasHaut = d.zones.indexOf("bras_haut");
      const membres: number[] = [];
      for (let i = 0; i < d.sommets; i++) {
        if (!dans[i]) continue;
        membres.push(i);
        const x = repos[i * 3], y = repos[i * 3 + 1];
        const cote = Math.abs(nrm[i * 3]) > 0.86 && d.zoneDe[i] !== brasHaut; // bande étroite sur le côté
        const hauteurTorse = (y - yMin) / Math.max(yMax - yMin, 0.01);
        const logo = v.logo && d.zoneDe[i] === torseHaut && nrm[i * 3 + 2] > 0.75 && x > 0.18 && x < 0.55 && hauteurTorse > 0.45 && hauteurTorse < 0.62;
        const k = bord[i] ? cOurlet : (v.panneaux && cote) || logo ? cAccent : cBase;
        col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setIndex(tri);
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: v.rugosite, metalness: 0, side: THREE.DoubleSide }));
      mesh.scale.setScalar(DM);
      pivot.add(mesh);
      habits.push({ geo: g, mesh, membres: Int32Array.from(membres), epaisseur: v.epaisseur });
    }
    const r = reperes(repos, d);
    for (const g of accroches.values()) {
      for (const o of [...g.children]) { g.remove(o); (o as THREE.Mesh).geometry?.dispose(); }
    }
    for (const [os, o] of accessoires(c, r)) accroches.get(os)!.add(o);
    // le coureur posé au sol, centré ; la caméra cadre tout le corps
    pivot.position.y = -r.sol;
    poserCorps(poseActuelle);
    ombre.position.y = 0.001;
    hauteur = r.hauteur;
    // champ vertical de 26° : à 2,75 hauteurs de distance, on voit 1,27 hauteur (marge pour la tête et le sol)
    camera.position.set(0, hauteur * 0.58, hauteur * 2.75);
    camera.lookAt(0, hauteur * 0.52, 0);
  };
  regler(c0);
  return { scene, camera, pivot, regler, hauteur: () => hauteur, poser: poserCorps };
}
