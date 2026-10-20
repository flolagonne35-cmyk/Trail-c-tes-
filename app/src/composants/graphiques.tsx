// Graphiques SVG : profil du parcours segmenté, profil d'une côte, pentes par tranche, carte des côtes.

import { Platform, Text, View } from "react-native";
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import type { CoteProche } from "../calcul/cotes.ts";
import { projection, type Position } from "../calcul/geo.ts";
import type { Parcours } from "../calcul/profil.ts";
import { C, COULEUR_TYPE } from "../theme.ts";

const L = 342; // largeur du repère, comme dans la maquette
const POLICE = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, sans-serif" : undefined;

function echelles(dMax: number, zMin: number, zMax: number, haut: number, marge = 10) {
  const dz = Math.max(zMax - zMin, 1);
  return {
    x: (d: number) => (d / Math.max(dMax, 1e-9)) * L,
    y: (z: number) => marge + (1 - (z - zMin) / dz) * (haut - 2 * marge),
  };
}

export function ProfilParcours({ parcours }: { parcours: Parcours }) {
  const d = parcours.profil.d_km;
  const z = parcours.profil.z_m;
  if (d.length < 2) return null;
  const H = 130;
  const e = echelles(d[d.length - 1], Math.min(...z), Math.max(...z), H - 10);
  const pts = (i0: number, i1: number) => d.slice(i0, i1 + 1).map((v, k) => `${e.x(v)},${e.y(z[i0 + k])}`).join(" ");
  const indice = (km: number) => Math.min(d.length - 1, Math.max(0, Math.round(km / 0.05)));
  const aire = `M0 ${H} ` + d.map((v, k) => `L${e.x(v)} ${e.y(z[k])}`).join(" ") + ` L${L} ${H} Z`;
  return (
    <View>
      <Svg viewBox={`0 0 ${L} ${H}`} width="100%" height={H} accessibilityLabel={
        `Profil de ${parcours.nom} : ${parcours.nb_segments} segments, altitude de ${parcours.alt_min_m} à ${parcours.alt_max_m} m`}>
        <Path d={aire} fill={C.aire} />
        {parcours.segments.map((s) => (
          <Polyline key={s.n} points={pts(indice(s.km_debut), indice(s.km_fin))} fill="none"
                    stroke={COULEUR_TYPE[s.type].trait} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        {(["montée", "descente", "plat"] as const).map((t) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: COULEUR_TYPE[t].trait }} />
            <Text style={{ fontSize: 12, color: C.gris }}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProfilCote({ cote, seuilRaide = 12 }: { cote: CoteProche; seuilRaide?: number }) {
  const { d, z } = cote.profil;
  if (d.length < 2) return null;
  const H = 130;
  const e = echelles(d[d.length - 1], Math.min(...z), Math.max(...z), H - 18);
  const aire = `M0 ${H - 18} ` + d.map((v, k) => `L${e.x(v)} ${e.y(z[k])}`).join(" ") + ` L${L} ${H - 18} Z`;
  // morceaux colorés selon la pente locale
  const morceaux: { raide: boolean; pts: string[] }[] = [];
  for (let k = 1; k < d.length; k++) {
    const raide = ((z[k] - z[k - 1]) / Math.max(d[k] - d[k - 1], 1e-9)) * 100 > seuilRaide;
    const p0 = `${e.x(d[k - 1])},${e.y(z[k - 1])}`;
    const p1 = `${e.x(d[k])},${e.y(z[k])}`;
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.raide === raide) dernier.pts.push(p1);
    else morceaux.push({ raide, pts: [p0, p1] });
  }
  return (
    <Svg viewBox={`0 0 ${L} ${H}`} width="100%" height={H}
         accessibilityLabel={`Profil de la côte : ${Math.round(cote.longueur_m)} m, ${Math.round(cote.dplus_m)} m de dénivelé`}>
      <Path d={aire} fill={C.aire} />
      {morceaux.map((m, i) => (
        <Polyline key={i} points={m.pts.join(" ")} fill="none" stroke={m.raide ? C.monteeFonce : C.montee}
                  strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <Circle cx={0} cy={e.y(z[0])} r={6} fill={C.descente} stroke={C.blanc} strokeWidth={2} />
      <Circle cx={L} cy={e.y(z[z.length - 1])} r={6} fill={C.encre} stroke={C.blanc} strokeWidth={2} />
      <G fontSize={11} fill={C.gris} fontFamily={POLICE}>
        <SvgText x={2} y={H - 3}>Départ</SvgText>
        <SvgText x={L / 2} y={H - 3} textAnchor="middle">{Math.round(d[d.length - 1] / 2)} m</SvgText>
        <SvgText x={L - 2} y={H - 3} textAnchor="end">Arrivée</SvgText>
      </G>
    </Svg>
  );
}

export function BarresPentes({ pentes, longueur, seuilRaide = 12 }: { pentes: number[]; longueur: number; seuilRaide?: number }) {
  if (!pentes.length) return null;
  const H = 110;
  const n = pentes.length;
  const largeur = L / n;
  const max = Math.max(...pentes.map(Math.abs), 1);
  const afficherValeurs = n <= 24;
  return (
    <Svg viewBox={`0 0 ${L} ${H}`} width="100%" height={H}
         accessibilityLabel={`Pente par tranche de 50 m : de ${Math.min(...pentes)} à ${Math.max(...pentes)} %`}>
      {pentes.map((p, i) => {
        const h = (Math.abs(p) / max) * 60;
        return (
          <G key={i}>
            <Rect x={i * largeur + 2} y={94 - h} width={Math.max(largeur - 6, 1)} height={h} rx={3}
                  fill={p > seuilRaide ? C.monteeFonce : C.montee} />
            {afficherValeurs && (
              <SvgText x={i * largeur + largeur / 2} y={88 - h} fontSize={11} fontWeight="700" fill={C.encre}
                       textAnchor="middle" fontFamily={POLICE}>{Math.round(p)}</SvgText>
            )}
          </G>
        );
      })}
      <SvgText x={2} y={108} fontSize={11} fill={C.gris} fontFamily={POLICE}>0 m</SvgText>
      <SvgText x={L - 2} y={108} fontSize={11} fill={C.gris} textAnchor="end" fontFamily={POLICE}>{Math.round(longueur)} m</SvgText>
    </Svg>
  );
}

export function CarteCotes({ position, cotes, rayonM, selection }: {
  position: Position; cotes: CoteProche[]; rayonM: number; selection?: number;
}) {
  const W = 350;
  const H = 190;
  const proj = projection(position.lat, position.lon);
  // zoom sur les côtes affichées (le cercle du rayon n'est dessiné que s'il tient dans le cadre)
  const etendue = Math.min(rayonM, Math.max(500, ...cotes.map((c) => c.distance_m)) * 1.15);
  const echelle = (H / 2 - 14) / etendue;
  const vers = (lat: number, lon: number) => {
    const [x, y] = proj.xy(lat, lon);
    return [W / 2 + x * echelle, H / 2 - y * echelle];
  };
  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
         accessibilityLabel={`Carte schématique : votre position au centre et ${cotes.length} côtes dans un rayon de ${rayonM / 1000} km`}>
      <Rect width={W} height={H} fill={C.carte} />
      {rayonM * echelle <= W / 2 && (
        <Circle cx={W / 2} cy={H / 2} r={rayonM * echelle} fill="none" stroke={C.encre} strokeWidth={1.5} strokeDasharray="4 4" />
      )}
      <SvgText x={W - 8} y={H - 8} fontSize={10} fill={C.gris} textAnchor="end" fontFamily={POLICE}>
        {etendue >= 1000 ? `${(etendue / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(etendue)} m`} du centre au bord
      </SvgText>
      {cotes.map((c) => (
        <Polyline key={c.id} points={c.geometrie.map(([lon, lat]) => vers(lat, lon).join(",")).join(" ")}
                  fill="none" stroke={c.id === selection ? C.monteeFonce : C.montee} strokeWidth={3} strokeLinecap="round" />
      ))}
      <Circle cx={W / 2} cy={H / 2} r={9} fill={C.descente} stroke={C.blanc} strokeWidth={3} />
      {cotes.slice(0, 9).map((c, i) => {
        const [x, y] = vers(c.lat, c.lon);
        return (
          <G key={c.id}>
            <Circle cx={x} cy={y} r={11} fill={i === 0 ? C.monteeFonce : C.montee} stroke={C.blanc} strokeWidth={2} />
            <SvgText x={x} y={y + 4} fontSize={11} fontWeight="700" fill={C.blanc} textAnchor="middle" fontFamily={POLICE}>{i + 1}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
