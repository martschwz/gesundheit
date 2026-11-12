// Berechnungen: Kalorienbedarf, Gewichtstrend und Prognose.
import type { FoodItem, Nutrients, Settings, Slot } from "./types";
import { addDays, diffDays } from "./date";

export const ACTIVITY: [number, string, string][] = [
  [1.2, "Kaum Bewegung", "Bürojob, wenig Sport"],
  [1.375, "Etwas aktiv", "Viel zu Fuß oder 1–3× Sport pro Woche"],
  [1.55, "Aktiv", "3–5× Sport pro Woche"],
  [1.725, "Sehr aktiv", "Körperliche Arbeit oder täglich Sport"],
];
export const PACES = [0.25, 0.5, 0.75];
export const SLOTS: [Slot, string][] = [
  ["fruehstueck", "Frühstück"],
  ["mittag", "Mittag"],
  ["abend", "Abend"],
  ["snack", "Snack"],
];
export const slotLabel = (s: Slot) => SLOTS.find(([k]) => k === s)?.[1] ?? "Snack";

/** Passende Mahlzeit zur Uhrzeit. */
export function slotForHour(h: number): Slot {
  if (h >= 4 && h < 11) return "fruehstueck";
  if (h >= 11 && h < 15) return "mittag";
  if (h >= 17 && h < 22) return "abend";
  return "snack";
}

/** Grundumsatz nach Mifflin-St Jeor. */
export function bmr(s: Pick<Settings, "sex" | "birth_year" | "height_cm">, kg: number, year = new Date().getFullYear()): number {
  const age = year - s.birth_year;
  return 10 * kg + 6.25 * s.height_cm - 5 * age + (s.sex === "m" ? 5 : -161);
}

export type Goals = { bmr: number; tdee: number; kcal: number; protein: number; floor: number; limited: boolean };

/** Tagesziele. Ein Kilo Körperfett entspricht etwa 7000 kcal. */
export function goals(s: Settings, kg: number, year?: number): Goals {
  const b = bmr(s, kg, year);
  const tdee = b * s.activity;
  const floor = s.sex === "m" ? 1500 : 1200;
  const wanted = tdee - (s.pace * 7000) / 7;
  const limited = wanted < floor;
  const kcal = s.kcal_override ?? Math.round(Math.max(floor, wanted) / 10) * 10;
  const protein = s.protein_override ?? Math.round(1.6 * Math.min(kg, s.target_weight + 10));
  return { bmr: Math.round(b), tdee: Math.round(tdee), kcal, protein, floor, limited };
}

export const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2;

export type TrendPoint = { day: string; kg: number; trend: number };

/**
 * Geglätteter Gewichtsverlauf: Tagesschwankungen (Wasser, Essen) werden herausgerechnet.
 * Jeder Tag zieht den Trend um 10 % in Richtung des gemessenen Werts; Lücken zählen als mehrere Tage.
 */
export function trend(weights: { day: string; kg: number }[]): TrendPoint[] {
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const out: TrendPoint[] = [];
  let t: number | null = null;
  let last: string | null = null;
  for (const w of sorted) {
    if (t === null || last === null) t = w.kg;
    else {
      const gap = Math.max(1, diffDays(last, w.day));
      const a = 1 - 0.9 ** gap;
      t = t + a * (w.kg - t);
    }
    last = w.day;
    out.push({ day: w.day, kg: w.kg, trend: t });
  }
  return out;
}

export type Forecast = { perWeek: number | null; date: string | null; reached: boolean };

/** Tempo der letzten 4 Wochen und voraussichtliches Datum fürs Zielgewicht. */
export function forecast(points: TrendPoint[], target: number): Forecast {
  if (!points.length) return { perWeek: null, date: null, reached: false };
  const lastP = points[points.length - 1];
  if (lastP.trend <= target) return { perWeek: null, date: null, reached: true };
  const recent = points.filter((p) => diffDays(p.day, lastP.day) <= 28);
  const span = diffDays(recent[0].day, lastP.day);
  if (recent.length < 4 || span < 7) return { perWeek: null, date: null, reached: false };
  // Lineare Regression über den Trend
  const xs = recent.map((p) => diffDays(recent[0].day, p.day));
  const ys = recent.map((p) => p.trend);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  const slope = den ? num / den : 0; // kg pro Tag
  const perWeek = slope * 7;
  if (slope >= -0.005) return { perWeek, date: null, reached: false };
  const days = Math.ceil((lastP.trend - target) / -slope);
  if (days > 3 * 365) return { perWeek, date: null, reached: false };
  return { perWeek, date: addDays(lastP.day, days), reached: false };
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce((a, b) => ({ kcal: a.kcal + (b.kcal || 0), protein: a.protein + (b.protein || 0), carbs: a.carbs + (b.carbs || 0), fat: a.fat + (b.fat || 0) }), { ...ZERO });
}

export function scaleItems(items: FoodItem[], f: number): FoodItem[] {
  if (f === 1) return items;
  const r = (n: number) => Math.round(n * f);
  return items.map((i) => ({ ...i, amount: i.amount ? `${i.amount} ×${String(f).replace(".", ",")}` : "", kcal: r(i.kcal), protein: r(i.protein), carbs: r(i.carbs), fat: r(i.fat) }));
}

/** Zahl aus Eingabe lesen (Komma oder Punkt). */
export function parseNum(s: string): number | null {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
}

export const fmt = (n: number, digits = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
