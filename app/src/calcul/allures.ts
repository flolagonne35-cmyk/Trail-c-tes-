// Convertisseur d'allure : min/km ↔ km/h, temps sur les distances classiques, et prédiction de temps
// d'une distance à une autre par la formule de Riegel (T2 = T1 × (D2/D1)^1,06 ; Riegel, American
// Scientist, 1981). Valable sur route de 1,5 km au marathon environ ; au-delà, et en trail, elle est
// optimiste : on le dit à l'écran.

export const DISTANCES: [string, number][] = [["5 km", 5], ["10 km", 10], ["Semi", 21.0975], ["Marathon", 42.195]];

export const vitesseDe = (allureMinKm: number) => 60 / allureMinKm;
export const allureDe = (kmh: number) => 60 / kmh;

/** « 4:30 » ou « 4'30 » ou « 4.5 » → minutes par km (NaN si illisible). */
export function lireAllure(t: string): number {
  const m = t.trim().match(/^(\d{1,2})\s*[:'’]\s*(\d{1,2})$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  return parseFloat(t.replace(",", "."));
}

/** « 1:45:30 », « 45:30 », « 3h05 » → minutes (NaN si illisible). */
export function lireTemps(t: string): number {
  const s = t.trim().toLowerCase().replace(/\s/g, "");
  let m = s.match(/^(\d+)h(\d{1,2})?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) + Number(m[2]) / 60;
  return NaN;
}

export const riegel = (tempsMin: number, d1: number, d2: number) => tempsMin * (d2 / d1) ** 1.06;

/** « 4:05 /km » à partir de minutes par km. */
export function allureLisible(min: number): string {
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** « 1 h 45 min 30 s » → ici plus court : « 1:45:30 » ou « 45:30 ». */
export function tempsLisible(min: number): string {
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s % 60).padStart(2, "0")}`;
}
