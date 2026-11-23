// Paysage de crêtes au lever du soleil (SVG) : l'image de marque de Trail-côtes, en fond des
// grands bandeaux (bienvenue, accueil). Pur dessin vectoriel : net à toutes les tailles, léger.

import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";

export function Paysage({ hauteur = 420, sentier = true }: { hauteur?: number; sentier?: boolean }) {
  return (
    <Svg width="100%" height={hauteur} viewBox="0 0 400 420" preserveAspectRatio="xMidYMax slice"
         style={{ position: "absolute", left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#14231B" />
          <Stop offset="0.55" stopColor="#2B4A39" />
          <Stop offset="0.85" stopColor="#B8673E" />
          <Stop offset="1" stopColor="#E8572A" />
        </LinearGradient>
        <RadialGradient id="halo" cx="0.68" cy="0.62" r="0.45">
          <Stop offset="0" stopColor="#FFB27A" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFB27A" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="c1" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#3C5A47" /><Stop offset="1" stopColor="#24392C" /></LinearGradient>
        <LinearGradient id="c2" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2A4234" /><Stop offset="1" stopColor="#182920" /></LinearGradient>
        <LinearGradient id="c3" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#1A2C22" /><Stop offset="1" stopColor="#0F1A14" /></LinearGradient>
      </Defs>
      <Path d="M0 0H400V420H0Z" fill="url(#ciel)" />
      <Path d="M0 0H400V420H0Z" fill="url(#halo)" />
      <Circle cx={272} cy={262} r={34} fill="#FFC58F" opacity={0.95} />
      <Path d="M0 300 L48 262 L92 284 L150 214 L196 252 L236 226 L290 270 L338 236 L400 268 V420 H0 Z" fill="url(#c1)" />
      <Path d="M150 214 L160 226 L170 222 L178 232 L184 226 L196 252" fill="none" stroke="#F6F4EF" strokeWidth={1.4} opacity={0.35} />
      <Path d="M0 338 L60 306 L118 330 L182 290 L240 322 L300 296 L360 320 L400 306 V420 H0 Z" fill="url(#c2)" />
      <Path d="M0 376 L70 350 L140 368 L210 342 L280 366 L350 348 L400 360 V420 H0 Z" fill="url(#c3)" />
      {sentier && (
        <Path d="M120 420 C 150 398, 210 392, 196 376 S 150 360, 186 348 S 250 336, 232 322" fill="none" stroke="#E8572A"
              strokeWidth={3} strokeLinecap="round" strokeDasharray="1 7" opacity={0.9} />
      )}
    </Svg>
  );
}
