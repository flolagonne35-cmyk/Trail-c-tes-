// Avatar du coureur, dessiné en SVG à partir de l'apparence choisie.

import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";

import { CHEVEUX, PEAUX, TENUES, type Apparence } from "../profil.ts";
import { C } from "../theme.ts";

export function Avatar({ a, taille = 120 }: { a: Apparence; taille?: number }) {
  const peau = PEAUX[a.peau];
  const cheveux = CHEVEUX[a.cheveux];
  const haut = TENUES[a.haut];
  const bas = TENUES[a.bas];
  const femme = a.silhouette === "femme";
  const epaules = femme ? 20 : 24; // demi-largeur du torse

  return (
    <Svg width={taille} height={(taille * 160) / 120} viewBox="0 0 120 160" accessibilityLabel="Avatar du coureur">
      <Circle cx={60} cy={84} r={56} fill={C.sable} />
      {/* cheveux longs : derrière la tête */}
      {a.coupe === "longue" && <Path d="M40 38 Q38 70 46 74 L74 74 Q82 70 80 38 Z" fill={cheveux} />}
      {a.coupe === "queue" && <Path d="M76 34 Q92 44 84 66 Q80 52 72 42 Z" fill={cheveux} />}

      {/* bâtons de trail, tenus en main */}
      {a.batons && (
        <G stroke="#3F463F" strokeWidth={2.5} strokeLinecap="round">
          <Line x1={34} y1={92} x2={20} y2={150} />
          <Line x1={86} y1={92} x2={100} y2={150} />
          <Line x1={31} y1={89} x2={37} y2={95} stroke="#1B2A22" strokeWidth={4} />
          <Line x1={83} y1={95} x2={89} y2={89} stroke="#1B2A22" strokeWidth={4} />
        </G>
      )}

      {/* jambes et chaussures */}
      <Rect x={49} y={108} width={9} height={34} rx={4} fill={peau} />
      <Rect x={62} y={108} width={9} height={34} rx={4} fill={peau} />
      <Ellipse cx={52} cy={145} rx={8} ry={4} fill="#1B2A22" />
      <Ellipse cx={68} cy={145} rx={8} ry={4} fill="#1B2A22" />
      {/* short */}
      <Path d={`M${60 - epaules + 4} 98 L${60 + epaules - 4} 98 L${60 + epaules - 2} 118 L62 118 L60 110 L58 118 L${60 - epaules + 2} 118 Z`}
            fill={bas} />
      {/* bras */}
      <Path d={`M${60 - epaules} 66 Q${40 - epaules / 3} 80 34 92`} stroke={peau} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d={`M${60 + epaules} 66 Q${80 + epaules / 3} 80 86 92`} stroke={peau} strokeWidth={7} strokeLinecap="round" fill="none" />
      {/* maillot */}
      <Path d={`M${60 - epaules} 64 Q60 58 ${60 + epaules} 64 L${60 + epaules - 3} 102 L${60 - epaules + 3} 102 Z`} fill={haut}
            stroke="#00000022" strokeWidth={1} />
      <Rect x={52} y={78} width={16} height={11} rx={2} fill={C.blanc} />
      {/* cou et tête */}
      <Rect x={55} y={52} width={10} height={10} rx={3} fill={peau} />
      <Circle cx={60} cy={40} r={17} fill={peau} />
      <Circle cx={54} cy={41} r={1.8} fill="#1B2A22" />
      <Circle cx={66} cy={41} r={1.8} fill="#1B2A22" />
      <Path d="M54 48 Q60 53 66 48" stroke="#1B2A22" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {!femme && a.coupe !== "longue" && <Path d="M48 50 Q60 60 72 50" stroke={cheveux} strokeWidth={1.2} fill="none" opacity={0.5} />}

      {/* cheveux sur le dessus */}
      {a.coupe === "rasee" && <Path d="M44 36 Q60 18 76 36 Q60 28 44 36 Z" fill={cheveux} opacity={0.7} />}
      {a.coupe !== "rasee" && <Path d="M42 40 Q42 20 60 21 Q78 20 78 40 Q70 30 60 31 Q50 30 42 40 Z" fill={cheveux} />}
      {a.coupe === "chignon" && <Circle cx={60} cy={20} r={7} fill={cheveux} />}
      {a.coupe === "queue" && <Circle cx={76} cy={33} r={3} fill={TENUES[a.haut]} />}

      {/* casquette */}
      {a.casquette && (
        <G>
          <Path d="M42 34 Q44 18 60 18 Q76 18 78 34 Z" fill={haut} />
          <Path d="M40 34 L82 34 Q88 36 92 39 L40 37 Z" fill={bas} />
        </G>
      )}
    </Svg>
  );
}
