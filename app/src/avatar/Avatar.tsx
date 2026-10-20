// Avatar du coureur de trail, dessiné en SVG par couches : fond montagne, jambes, chaussures,
// bas, torse, haut, gilet, bras, bâtons, tête (visage, barbe, cheveux, couvre-chef, lunettes).
// Repère 200 × 280, pieds en bas ; corpulence et taille déforment le corps, pas la tête.

import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { CHEVEUX, PEAUX, TISSUS, YEUX, type Apparence } from "./modele.ts";

const LARGEUR = { affine: 0.86, athletique: 0.95, moyenne: 1.03, robuste: 1.13, forte: 1.26 } as const;
const HAUTEUR = { petite: 0.92, moyenne: 1, grande: 1.07 } as const;

/** Assombrit (f < 1) ou éclaircit (f > 1) une couleur #rrggbb. */
function teinte(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)));
  return `#${c.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0")).join("")}`;
}

/** `cadrage` « buste » : tête et épaules, lisible en petit (classement, en-tête). */
export function Avatar({ a, taille = 160, fond = true, cadrage = "pied" }: {
  a: Apparence; taille?: number; fond?: boolean; cadrage?: "pied" | "buste";
}) {
  const k = LARGEUR[a.corpulence];
  const h = HAUTEUR[a.taille];
  const femme = a.silhouette === "femme";
  const peau = PEAUX[a.peau];
  const peauOmbre = teinte(peau, 0.86);
  const cheveux = CHEVEUX[a.cheveux];
  const haut = TISSUS[a.couleurHaut];
  const bande = TISSUS[a.couleurBande];
  const bas = TISSUS[a.couleurBas];
  const chaussure = TISSUS[a.chaussures];
  const sac = TISSUS[a.couleurSac];
  const couvre = TISSUS[a.couleurTete];
  const encre = "#1A1F2B";

  // squelette (x centré à 100)
  const cx = 100;
  const yCheville = 252;
  const yGenou = yCheville - 42 * h;
  const yHanche = yGenou - 44 * h;
  const yTaille = yHanche - 16 * h;
  const yEpaule = yTaille - 56 * h;
  const yCou = yEpaule - 12;
  const cy = yCou - 23; // centre de la tête
  const S = (femme ? 30 : 34) * k; // demi-largeur des épaules
  const W = (femme ? 22 : 26) * k * (a.corpulence === "forte" ? 1.18 : a.corpulence === "robuste" ? 1.06 : 1);
  const H = (femme ? 29 : 26) * k;
  const bras = 11.5 * k;
  const cuisse = 18 * k;
  const mollet = 13.5 * k;
  const ecartJambe = Math.max(13, H * 0.5);

  const epaule = (s: number) => [cx + s * (S - 5), yEpaule + 3];
  const coude = (s: number) => [cx + s * (S + 9 * k), yEpaule + 34 * h];
  const main = (s: number) => [cx + s * (S + (a.batons ? 13 : 5) * k), yEpaule + 58 * h];
  const hanche = (s: number) => [cx + s * ecartJambe, yHanche - 4];
  const genou = (s: number) => [cx + s * (ecartJambe + 3), yGenou];
  const cheville = (s: number) => [cx + s * (ecartJambe + 7), yCheville];
  const tube = (pts: number[][]) => `M${pts.map((p) => p.join(" ")).join(" L")}`;

  const torse = `M${cx - S} ${yEpaule + 6} Q${cx - S} ${yEpaule - 5} ${cx - S + 11} ${yEpaule - 7} L${cx + S - 11} ${yEpaule - 7}
    Q${cx + S} ${yEpaule - 5} ${cx + S} ${yEpaule + 6} L${cx + W} ${yTaille} Q${cx + H + 1} ${(yTaille + yHanche) / 2} ${cx + H} ${yHanche + 2}
    L${cx - H} ${yHanche + 2} Q${cx - H - 1} ${(yTaille + yHanche) / 2} ${cx - W} ${yTaille} Z`;
  const debardeur = `M${cx - S + 9} ${yEpaule - 6} L${cx - 7} ${yEpaule - 6} Q${cx} ${yEpaule + 6} ${cx + 7} ${yEpaule - 6}
    L${cx + S - 9} ${yEpaule - 6} Q${cx + S - 6} ${yEpaule + 14} ${cx + W} ${yTaille} Q${cx + H + 1} ${(yTaille + yHanche) / 2} ${cx + H} ${yHanche + 2}
    L${cx - H} ${yHanche + 2} Q${cx - H - 1} ${(yTaille + yHanche) / 2} ${cx - W} ${yTaille} Q${cx - S + 6} ${yEpaule + 14} ${cx - S + 9} ${yEpaule - 6} Z`;
  const largeurA = (y: number) => (y < yTaille ? S + (W - S) * ((y - yEpaule) / (yTaille - yEpaule)) : W);

  const jambe = (s: number) => (
    <G key={`j${s}`}>
      <Path d={tube([hanche(s), genou(s)])} stroke={peau} strokeWidth={cuisse} strokeLinecap="round" fill="none" />
      <Path d={tube([genou(s), cheville(s)])} stroke={peau} strokeWidth={mollet} strokeLinecap="round" fill="none" />
      <Path d={tube([genou(s), cheville(s)])} stroke={peauOmbre} strokeWidth={mollet * 0.35} strokeLinecap="round" fill="none"
            transform={`translate(${s * mollet * 0.3} 0)`} opacity={0.6} />
    </G>
  );
  const basJambe = (s: number, jusque: "cuisse" | "mollet" | "cheville", couleur: string) => {
    const fin = jusque === "cuisse" ? [genou(s)[0], genou(s)[1] - 6]
      : jusque === "mollet" ? [(genou(s)[0] + cheville(s)[0]) / 2, (genou(s)[1] + cheville(s)[1]) / 2] : [cheville(s)[0], cheville(s)[1] - 7];
    const pts = jusque === "cuisse" ? [hanche(s), fin] : [hanche(s), genou(s), fin];
    return <Path key={`b${s}${jusque}`} d={tube(pts)} stroke={couleur} strokeWidth={cuisse + 1.5} strokeLinecap="round"
                 strokeLinejoin="round" fill="none" />;
  };
  const chaussureG = (s: number) => {
    const [x, y] = cheville(s);
    const l = 15 * Math.max(k, 0.95);
    return (
      <G key={`c${s}`}>
        <Rect x={x - 6} y={y - 6} width={12} height={6} rx={2} fill="#F4F4F2" />
        <Path d={`M${x - l} ${y + 12} Q${x - l} ${y - 2} ${x - 4} ${y - 3} L${x + 4} ${y - 3} Q${x + l} ${y - 2} ${x + l} ${y + 12} Z`}
              fill={chaussure} />
        <Path d={`M${x - l + 3} ${y + 3} L${x + l - 3} ${y + 3}`} stroke={teinte(chaussure, 0.7)} strokeWidth={1.5} />
        <Rect x={x - l - 1} y={y + 10} width={2 * l + 2} height={5} rx={2.5} fill="#F4F4F2" />
        <Rect x={x - l} y={y + 14} width={2 * l} height={4} rx={1.5} fill={encre} />
        {[-0.6, -0.2, 0.2, 0.6].map((t) => <Rect key={t} x={x + t * l - 2} y={y + 17} width={4} height={2.5} fill={encre} />)}
      </G>
    );
  };
  const brasG = (s: number, couleur: string, jusque: "epaule" | "coude" | "poignet") => {
    if (jusque === "epaule") return null;
    const pts = jusque === "coude" ? [epaule(s), [(epaule(s)[0] + coude(s)[0]) / 2, (epaule(s)[1] + coude(s)[1]) / 2 + 2]]
      : [epaule(s), coude(s), [main(s)[0] - s * 1, main(s)[1] - 7]];
    return <Path key={`m${s}${jusque}`} d={tube(pts)} stroke={couleur} strokeWidth={bras + 3} strokeLinecap="round"
                 strokeLinejoin="round" fill="none" />;
  };

  // tête
  const yeuxY = cy + 2;
  const oeil = (s: number) => {
    const x = cx + s * 8;
    const iris = YEUX[a.couleurYeux];
    if (a.yeux === "rieurs") {
      return <Path key={`o${s}`} d={`M${x - 3.6} ${yeuxY + 1} Q${x} ${yeuxY - 3.5} ${x + 3.6} ${yeuxY + 1}`} stroke={encre}
                   strokeWidth={1.8} strokeLinecap="round" fill="none" />;
    }
    const ry = a.yeux === "ronds" ? 3.6 : a.yeux === "concentres" ? 2 : 2.8;
    return (
      <G key={`o${s}`}>
        {a.yeux === "amande" || a.yeux === "concentres"
          ? <Path d={`M${x - 4.2} ${yeuxY} Q${x} ${yeuxY - ry * 1.6} ${x + 4.2} ${yeuxY} Q${x} ${yeuxY + ry * 1.3} ${x - 4.2} ${yeuxY} Z`} fill="#FFFFFF" />
          : <Ellipse cx={x} cy={yeuxY} rx={3.4} ry={ry} fill="#FFFFFF" />}
        <Circle cx={x + s * 0.3} cy={yeuxY + 0.2} r={a.yeux === "concentres" ? 1.7 : 2.3} fill={iris} />
        <Circle cx={x + s * 0.3} cy={yeuxY + 0.2} r={1.1} fill={encre} />
        <Circle cx={x + s * 0.3 + 0.8} cy={yeuxY - 0.8} r={0.6} fill="#FFFFFF" />
        {a.yeux === "concentres" && <Path d={`M${x - 4.4} ${yeuxY - 1.2} L${x + 4.4} ${yeuxY - 1.2}`} stroke={peauOmbre} strokeWidth={2} />}
        {femme && <Path d={`M${x + s * 3.4} ${yeuxY - 1.5} l${s * 1.8} -1.6`} stroke={encre} strokeWidth={1} strokeLinecap="round" />}
      </G>
    );
  };
  const sourcil = (s: number) => {
    const x = cx + s * 8;
    const y = cy - 6;
    const ep = a.sourcils === "epais" ? 2.8 : 1.6;
    const d = a.sourcils === "arques"
      ? `M${x - s * 4.5} ${y + 1.5} Q${x} ${y - 3} ${x + s * 4.5} ${y + 0.5}`
      : `M${x - s * 4.5} ${y + 0.8} Q${x} ${y - 1} ${x + s * 4.5} ${y + 0.8}`;
    return <Path key={`s${s}`} d={d} stroke={teinte(cheveux, 0.8)} strokeWidth={ep} strokeLinecap="round" fill="none" />;
  };
  const yBouche = cy + 13;
  const bouche = {
    sourire: <Path d={`M${cx - 5} ${yBouche - 1} Q${cx} ${yBouche + 4} ${cx + 5} ${yBouche - 1}`} stroke={teinte(peau, 0.55)}
                   strokeWidth={1.8} strokeLinecap="round" fill="none" />,
    dents: <Path d={`M${cx - 6} ${yBouche - 2} Q${cx} ${yBouche + 7} ${cx + 6} ${yBouche - 2} Z`} fill="#FFFFFF"
                 stroke={teinte(peau, 0.5)} strokeWidth={1.4} strokeLinejoin="round" />,
    neutre: <Path d={`M${cx - 4} ${yBouche} L${cx + 4} ${yBouche}`} stroke={teinte(peau, 0.55)} strokeWidth={1.8} strokeLinecap="round" />,
    effort: <G><Rect x={cx - 5} y={yBouche - 2.5} width={10} height={5} rx={2.5} fill="#FFFFFF" stroke={teinte(peau, 0.5)} strokeWidth={1.3} />
      <Line x1={cx - 5} y1={yBouche} x2={cx + 5} y2={yBouche} stroke={teinte(peau, 0.6)} strokeWidth={0.8} /></G>,
  }[a.bouche];

  const crane = `M${cx - 21} ${cy + 2} Q${cx - 22} ${cy - 25} ${cx} ${cy - 26} Q${cx + 22} ${cy - 25} ${cx + 21} ${cy + 2}`;
  const cheveuxArriere = {
    rasee: null, courte: null,
    "mi-longue": <Path d={`M${cx - 23} ${cy - 4} Q${cx - 26} ${cy + 22} ${cx - 17} ${cy + 26} L${cx + 17} ${cy + 26} Q${cx + 26} ${cy + 22} ${cx + 23} ${cy - 4} Z`} fill={cheveux} />,
    longue: <Path d={`M${cx - 23} ${cy - 6} Q${cx - 29} ${cy + 40} ${cx - 22} ${yEpaule + 22} L${cx + 22} ${yEpaule + 22} Q${cx + 29} ${cy + 40} ${cx + 23} ${cy - 6} Z`} fill={cheveux} />,
    queue: <Path d={`M${cx + 14} ${cy - 22} Q${cx + 40} ${cy - 22} ${cx + 33} ${cy + 18} Q${cx + 30} ${cy + 34} ${cx + 24} ${cy + 40} Q${cx + 26} ${cy + 14} ${cx + 12} ${cy - 10} Z`} fill={cheveux} />,
    tresse: <G>{[0, 1, 2, 3, 4].map((i) => <Ellipse key={i} cx={cx + 21 + i * 1.5} cy={cy + 8 + i * 9} rx={5 - i * 0.4} ry={5.5} fill={i % 2 ? teinte(cheveux, 0.85) : cheveux} />)}</G>,
    chignon: <Circle cx={cx} cy={cy - 28} r={9} fill={cheveux} />,
    boucles: <G>{[-24, -17, 17, 24].map((dx) => <Circle key={dx} cx={cx + dx} cy={cy + 6} r={8} fill={cheveux} />)}</G>,
  }[a.coupe];
  const cheveuxAvant = {
    rasee: <Path d={`${crane} Q${cx + 12} ${cy - 18} ${cx} ${cy - 19} Q${cx - 12} ${cy - 18} ${cx - 21} ${cy + 2} Z`} fill={cheveux} opacity={0.55} />,
    courte: <Path d={`M${cx - 22} ${cy} Q${cx - 24} ${cy - 27} ${cx} ${cy - 28} Q${cx + 24} ${cy - 27} ${cx + 22} ${cy} Q${cx + 18} ${cy - 13} ${cx + 4} ${cy - 15} Q${cx - 8} ${cy - 11} ${cx - 16} ${cy - 15} Q${cx - 20} ${cy - 8} ${cx - 22} ${cy} Z`} fill={cheveux} />,
    "mi-longue": <Path d={`M${cx - 23} ${cy + 12} Q${cx - 25} ${cy - 28} ${cx} ${cy - 28} Q${cx + 25} ${cy - 28} ${cx + 23} ${cy + 12} Q${cx + 20} ${cy - 10} ${cx + 9} ${cy - 16} Q${cx - 6} ${cy - 10} ${cx - 18} ${cy - 12} Q${cx - 21} ${cy} ${cx - 23} ${cy + 12} Z`} fill={cheveux} />,
    longue: <Path d={`M${cx - 23} ${cy + 16} Q${cx - 25} ${cy - 28} ${cx} ${cy - 28} Q${cx + 25} ${cy - 28} ${cx + 23} ${cy + 16} Q${cx + 21} ${cy - 8} ${cx + 3} ${cy - 17} Q${cx - 12} ${cy - 10} ${cx - 19} ${cy - 8} Q${cx - 22} ${cy + 2} ${cx - 23} ${cy + 16} Z`} fill={cheveux} />,
    queue: <Path d={`M${cx - 22} ${cy - 1} Q${cx - 23} ${cy - 27} ${cx} ${cy - 27} Q${cx + 23} ${cy - 27} ${cx + 22} ${cy - 1} Q${cx + 16} ${cy - 18} ${cx} ${cy - 18} Q${cx - 16} ${cy - 18} ${cx - 22} ${cy - 1} Z`} fill={cheveux} />,
    tresse: <Path d={`M${cx - 22} ${cy - 1} Q${cx - 23} ${cy - 27} ${cx} ${cy - 27} Q${cx + 23} ${cy - 27} ${cx + 22} ${cy - 1} Q${cx + 14} ${cy - 17} ${cx - 2} ${cy - 18} Q${cx - 16} ${cy - 16} ${cx - 22} ${cy - 1} Z`} fill={cheveux} />,
    chignon: <Path d={`M${cx - 22} ${cy - 1} Q${cx - 23} ${cy - 27} ${cx} ${cy - 27} Q${cx + 23} ${cy - 27} ${cx + 22} ${cy - 1} Q${cx + 16} ${cy - 18} ${cx} ${cy - 18} Q${cx - 16} ${cy - 18} ${cx - 22} ${cy - 1} Z`} fill={cheveux} />,
    boucles: <G>{[[-18, -12], [-10, -20], [0, -23], [10, -20], [18, -12], [-21, -2], [21, -2]].map(([dx, dy]) =>
      <Circle key={`${dx}${dy}`} cx={cx + dx} cy={cy + dy} r={8} fill={cheveux} />)}</G>,
  }[a.coupe];
  const barbe = {
    aucune: null,
    courte: <Path d={`M${cx - 20} ${cy + 3} Q${cx - 19} ${cy + 24} ${cx} ${cy + 26} Q${cx + 19} ${cy + 24} ${cx + 20} ${cy + 3} Q${cx + 14} ${cy + 16} ${cx + 6} ${cy + 10} Q${cx} ${cy + 9} ${cx - 6} ${cy + 10} Q${cx - 14} ${cy + 16} ${cx - 20} ${cy + 3} Z`} fill={cheveux} opacity={0.85} />,
    longue: <Path d={`M${cx - 20} ${cy + 3} Q${cx - 20} ${cy + 36} ${cx} ${cy + 40} Q${cx + 20} ${cy + 36} ${cx + 20} ${cy + 3} Q${cx + 14} ${cy + 16} ${cx + 6} ${cy + 10} Q${cx} ${cy + 9} ${cx - 6} ${cy + 10} Q${cx - 14} ${cy + 16} ${cx - 20} ${cy + 3} Z`} fill={cheveux} />,
    moustache: <Path d={`M${cx - 8} ${yBouche - 2} Q${cx} ${yBouche - 7} ${cx + 8} ${yBouche - 2} Q${cx} ${yBouche - 4} ${cx - 8} ${yBouche - 2} Z`} fill={cheveux} />,
    bouc: <G><Path d={`M${cx - 7} ${yBouche - 2} Q${cx} ${yBouche - 6} ${cx + 7} ${yBouche - 2}`} stroke={cheveux} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d={`M${cx - 5} ${yBouche + 4} Q${cx} ${yBouche + 12} ${cx + 5} ${yBouche + 4} Z`} fill={cheveux} /></G>,
  }[a.barbe];
  const couvreChef = {
    aucun: null,
    casquette: <G>
      <Path d={`M${cx - 22} ${cy - 6} Q${cx - 22} ${cy - 31} ${cx} ${cy - 31} Q${cx + 22} ${cy - 31} ${cx + 22} ${cy - 6} Z`} fill={couvre} />
      <Path d={`M${cx - 22} ${cy - 6} Q${cx} ${cy - 11} ${cx + 22} ${cy - 6}`} stroke={teinte(couvre, 0.75)} strokeWidth={1.5} fill="none" />
      <Path d={`M${cx - 20} ${cy - 6} Q${cx} ${cy - 2} ${cx + 20} ${cy - 6} Q${cx + 14} ${cy + 1} ${cx} ${cy + 1} Q${cx - 14} ${cy + 1} ${cx - 20} ${cy - 6} Z`} fill={teinte(couvre, 0.8)} />
      <Circle cx={cx} cy={cy - 30} r={2} fill={teinte(couvre, 0.7)} />
    </G>,
    bandeau: <Path d={`M${cx - 22} ${cy - 9} Q${cx} ${cy - 15} ${cx + 22} ${cy - 9} L${cx + 22} ${cy - 2} Q${cx} ${cy - 8} ${cx - 22} ${cy - 2} Z`} fill={couvre} />,
    buff: null, // dessiné sur le cou
    bonnet: <G>
      <Path d={`M${cx - 23} ${cy - 6} Q${cx - 23} ${cy - 36} ${cx} ${cy - 36} Q${cx + 23} ${cy - 36} ${cx + 23} ${cy - 6} Z`} fill={couvre} />
      <Rect x={cx - 24} y={cy - 12} width={48} height={9} rx={4} fill={teinte(couvre, 0.82)} />
      <Circle cx={cx} cy={cy - 37} r={5} fill={teinte(couvre, 1.25)} />
    </G>,
  }[a.tete];

  // gilet, ceinture, dossard
  const gilet = a.sac === "gilet" && (
    <G>
      {[-1, 1].map((s) => (
        <G key={s}>
          <Path d={`M${cx + s * (S - 11)} ${yEpaule - 7} Q${cx + s * (S - 2)} ${yEpaule + 20} ${cx + s * (largeurA(yTaille - 8) - 1)} ${yTaille - 6}
                    L${cx + s * (largeurA(yTaille - 8) - 13)} ${yTaille - 6} Q${cx + s * (S - 14)} ${yEpaule + 18} ${cx + s * (S - 19)} ${yEpaule - 6} Z`}
                fill={sac} />
          <Rect x={cx + s * (S * 0.52) - 6.5} y={yEpaule + 10} width={13} height={25 * h} rx={6} fill="#D6ECFF" opacity={0.95} />
          <Rect x={cx + s * (S * 0.52) - 6.5} y={yEpaule + 10 + 10 * h} width={13} height={15 * h} rx={6} fill="#8CC9FF" opacity={0.9} />
          <Rect x={cx + s * (S * 0.52) - 3} y={yEpaule + 5} width={6} height={6} rx={1.5} fill={encre} />
        </G>
      ))}
      <Line x1={cx - S * 0.35} y1={yEpaule + 28} x2={cx + S * 0.35} y2={yEpaule + 28} stroke={teinte(sac, 0.7)} strokeWidth={2.5} />
      <Line x1={cx - S * 0.38} y1={yEpaule + 38} x2={cx + S * 0.38} y2={yEpaule + 38} stroke={teinte(sac, 0.7)} strokeWidth={2.5} />
    </G>
  );
  const ceinture = a.sac === "ceinture" && (
    <G>
      <Rect x={cx - H - 1} y={yHanche - 9} width={2 * H + 2} height={8} rx={3} fill={sac} />
      <Rect x={cx + H - 9} y={yHanche - 22} width={10} height={20} rx={4} fill="#8CC9FF" />
      <Rect x={cx + H - 7} y={yHanche - 26} width={6} height={5} rx={1.5} fill={encre} />
    </G>
  );
  const yDossard = a.sac === "gilet" ? yTaille - 4 : yEpaule + 26;
  const dossard = a.dossard.trim() !== "" && (
    <G>
      <Rect x={cx - 15} y={yDossard} width={30} height={20} rx={2} fill="#FFFFFF" stroke="#00000022" strokeWidth={0.8} />
      <Rect x={cx - 15} y={yDossard} width={30} height={4} rx={1} fill={bande} />
      <SvgText x={cx} y={yDossard + 16} fontSize={10} fontWeight="700" fill={encre} textAnchor="middle">{a.dossard.slice(0, 4)}</SvgText>
    </G>
  );

  const jambesCouvertes = a.bas === "collant" ? "cheville" : a.bas === "corsaire" ? "mollet" : a.bas === "short-cuissard" ? "cuisse" : null;
  const short = a.bas === "short" || a.bas === "short-cuissard";

  return (
    <Svg width={taille} height={cadrage === "buste" ? taille : (taille * 280) / 200}
         viewBox={cadrage === "buste" ? `${cx - 52} ${cy - 44} 104 104` : "0 0 200 280"} accessibilityLabel="Avatar du coureur">
      <Defs>
        <LinearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#CDE4F5" />
          <Stop offset="1" stopColor="#F3E7D3" />
        </LinearGradient>
        <LinearGradient id="verre" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2B6CFF" />
          <Stop offset="0.5" stopColor="#7B4DFF" />
          <Stop offset="1" stopColor="#FF5A1F" />
        </LinearGradient>
      </Defs>

      {fond && (
        <G>
          <Rect x={0} y={0} width={200} height={280} rx={cadrage === "buste" ? 0 : 26} fill="url(#ciel)" />
          <Circle cx={158} cy={52} r={16} fill="#FFE6A8" />
          <Path d="M0 176 L40 122 L64 146 L104 86 L142 140 L164 118 L200 160 L200 280 L0 280 Z" fill="#A9BFB1" />
          <Path d="M96 98 L104 86 L114 101 L107 98 L102 104 Z" fill="#FFFFFF" />
          <Path d="M0 196 L48 160 L90 190 L134 152 L200 196 L200 280 L0 280 Z" fill="#7A9A84" />
          <Path d="M0 236 Q60 214 100 226 Q150 240 200 220 L200 280 L0 280 Z" fill="#5F7F69" />
          <Path d="M70 280 Q96 250 132 236" stroke="#D9C9A6" strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.7} />
          <Ellipse cx={100} cy={268} rx={58} ry={6} fill="#00000026" />
        </G>
      )}

      {/* bâtons (derrière le corps en bas) */}
      {a.batons && [-1, 1].map((s) => {
        const [mx, my] = main(s);
        return (
          <G key={`p${s}`}>
            <Line x1={mx} y1={my - 2} x2={mx + s * 24} y2={270} stroke="#5E6670" strokeWidth={3} strokeLinecap="round" />
            <Circle cx={mx + s * 22.4} cy={262} r={3.5} fill="none" stroke={encre} strokeWidth={1.5} />
          </G>
        );
      })}

      {/* cheveux de dos */}
      {cheveuxArriere}

      {/* jambes, chaussures, bas */}
      {[-1, 1].map(jambe)}
      {[-1, 1].map(chaussureG)}
      {jambesCouvertes && [-1, 1].map((s) => basJambe(s, jambesCouvertes, a.bas === "short-cuissard" ? encre : bas))}
      {short && (
        <Path d={`M${cx - H - 1} ${yHanche - 8} L${cx + H + 1} ${yHanche - 8} L${cx + H + 5} ${yHanche + 22 * h} L${cx + 4} ${yHanche + 20 * h}
                  L${cx} ${yHanche + 6} L${cx - 4} ${yHanche + 20 * h} L${cx - H - 5} ${yHanche + 22 * h} Z`} fill={bas} />
      )}
      {short && <Path d={`M${cx + H - 2} ${yHanche - 4} L${cx + H + 3} ${yHanche + 20 * h}`} stroke={bande} strokeWidth={2} />}

      {/* cou, buff */}
      <Rect x={cx - 7.5} y={yCou - 6} width={15} height={14} rx={5} fill={peauOmbre} />
      {a.tete === "buff" && <Rect x={cx - 11} y={yCou - 4} width={22} height={11} rx={5} fill={couvre} />}

      {/* torse et haut */}
      <Path d={torse} fill={peau} />
      <Path d={a.haut === "debardeur" ? debardeur : torse} fill={haut} />
      <Path d={`M${cx - 3} ${yEpaule + 4} L${cx - 3} ${yHanche}`} stroke="#00000014" strokeWidth={1} />
      <Path d={`M${cx + S - 6} ${yEpaule + 2} Q${cx + W + 2} ${(yEpaule + yTaille) / 2} ${cx + W} ${yTaille} Q${cx + H + 1} ${(yTaille + yHanche) / 2} ${cx + H} ${yHanche + 2}
                L${cx + H - 8} ${yHanche + 2} Q${cx + W - 6} ${(yEpaule + yTaille) / 2} ${cx + S - 12} ${yEpaule + 2} Z`} fill="#00000016" />
      <Path d={`M${cx - largeurA(yEpaule + 22) + 1} ${yEpaule + 24} L${cx + largeurA(yEpaule + 22) - 1} ${yEpaule + 16}
                L${cx + largeurA(yEpaule + 26) - 1} ${yEpaule + 22} L${cx - largeurA(yEpaule + 30) + 1} ${yEpaule + 30} Z`} fill={bande} />
      {ceinture}
      {dossard}
      {gilet}

      {/* bras, manches, mains, montre */}
      {[-1, 1].map((s) => (
        <G key={`a${s}`}>
          <Path d={tube([epaule(s), coude(s), main(s)])} stroke={peau} strokeWidth={bras} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {brasG(s, haut, a.haut === "manches-longues" ? "poignet" : a.haut === "tshirt" ? "coude" : "epaule")}
          <Circle cx={main(s)[0]} cy={main(s)[1]} r={6.3 * Math.max(k, 0.92)} fill={peau} />
          {a.batons && <Rect x={main(s)[0] - 3} y={main(s)[1] - 9} width={6} height={13} rx={3} fill={encre} />}
        </G>
      ))}
      {a.montre && (
        <G>
          <Rect x={main(-1)[0] - 6} y={main(-1)[1] - 13} width={12} height={6} rx={2} fill={encre} />
          <Rect x={main(-1)[0] - 3.5} y={main(-1)[1] - 12} width={7} height={4} rx={1} fill="#2BD1A0" />
        </G>
      )}

      {/* tête */}
      {[-1, 1].map((s) => <Ellipse key={`e${s}`} cx={cx + s * 21} cy={cy + 3} rx={3.5} ry={5} fill={peauOmbre} />)}
      <Path d={`M${cx - 21} ${cy - 6} Q${cx - 22} ${cy + 20} ${cx} ${cy + 25} Q${cx + 22} ${cy + 20} ${cx + 21} ${cy - 6}
                Q${cx + 20} ${cy - 25} ${cx} ${cy - 26} Q${cx - 20} ${cy - 25} ${cx - 21} ${cy - 6} Z`} fill={peau} />
      <Path d={`M${cx + 12} ${cy - 20} Q${cx + 22} ${cy - 6} ${cx + 19} ${cy + 10} Q${cx + 14} ${cy + 22} ${cx + 4} ${cy + 24}
                Q${cx + 17} ${cy + 12} ${cx + 12} ${cy - 20} Z`} fill="#00000010" />
      <Circle cx={cx - 13} cy={cy + 9} r={4} fill="#FF7A7A" opacity={0.18} />
      <Circle cx={cx + 13} cy={cy + 9} r={4} fill="#FF7A7A" opacity={0.18} />
      {a.taches && [[-14, 6], [-11, 9], [-16, 10], [14, 6], [11, 9], [16, 10], [-2, 7], [2, 8]].map(([dx, dy]) =>
        <Circle key={`t${dx}${dy}`} cx={cx + dx} cy={cy + dy} r={0.8} fill={teinte(peau, 0.6)} />)}
      <Path d={`M${cx - 1} ${cy + 4} Q${cx + 2.5} ${cy + 8} ${cx - 1} ${cy + 9}`} stroke={teinte(peau, 0.7)} strokeWidth={1.4}
            strokeLinecap="round" fill="none" />
      {barbe}
      {bouche}
      {[-1, 1].map(oeil)}
      {[-1, 1].map(sourcil)}
      {a.tete !== "casquette" && a.tete !== "bonnet" && cheveuxAvant}
      {(a.tete === "casquette" || a.tete === "bonnet") && (a.coupe === "longue" || a.coupe === "mi-longue") && (
        <G>{[-1, 1].map((s) => <Path key={s} d={`M${cx + s * 21} ${cy - 6} Q${cx + s * 25} ${cy + 10} ${cx + s * 22} ${cy + 18} L${cx + s * 19} ${cy - 4} Z`} fill={cheveux} />)}</G>
      )}
      {couvreChef}
      {a.lunettes && (
        <G>
          <Path d={`M${cx - 21} ${yeuxY - 3} L${cx + 21} ${yeuxY - 3}`} stroke={encre} strokeWidth={2} />
          <Path d={`M${cx - 15} ${yeuxY - 5} Q${cx - 1} ${yeuxY - 7} ${cx} ${yeuxY - 3} Q${cx + 1} ${yeuxY - 7} ${cx + 15} ${yeuxY - 5}
                    Q${cx + 16} ${yeuxY + 5} ${cx + 7} ${yeuxY + 5} Q${cx + 1} ${yeuxY + 5} ${cx} ${yeuxY + 1}
                    Q${cx - 1} ${yeuxY + 5} ${cx - 7} ${yeuxY + 5} Q${cx - 16} ${yeuxY + 5} ${cx - 15} ${yeuxY - 5} Z`}
                fill="url(#verre)" stroke={encre} strokeWidth={1.2} />
          <Path d={`M${cx - 12} ${yeuxY - 3} L${cx - 8} ${yeuxY - 3}`} stroke="#FFFFFF" strokeWidth={1.2} opacity={0.7} strokeLinecap="round" />
        </G>
      )}
    </Svg>
  );
}
