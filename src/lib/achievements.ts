// Serien und Erfolge – werden aus den vorhandenen Daten berechnet, nichts extra gespeichert.
import { goals, sum, trend } from "./calc";
import { addDays, dayKey, diffDays } from "./date";
import { STEPS_GOAL, waterGoal } from "./health";
import type { Daily, Lab, Meal, Measurement, Settings, Weight } from "./types";

export type Streak = { current: number; best: number };

/** Tage am Stück. Heute zählt mit; ist heute noch nichts da, läuft die Serie ab gestern weiter. */
export function streak(days: Iterable<string>, today = dayKey()): Streak {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let d = set.has(today) ? today : addDays(today, -1);
  while (set.has(d)) { current++; d = addDays(d, -1); }
  return { current, best };
}

export type AchData = { settings: Settings; weights: Weight[]; meals: Meal[]; daily: Daily[]; measurements: Measurement[]; labs: Lab[] };
export type Achievement = { id: string; icon: string; title: string; text: string; done: boolean; progress?: [number, number] };

export function achievements(d: AchData, today = dayKey()): Achievement[] {
  const s = d.settings;
  const pts = trend(d.weights);
  const kg = pts.length ? pts[pts.length - 1].trend : s.start_weight;
  const lost = s.start_weight - kg;
  const total = s.start_weight - s.target_weight;
  const share = total > 0 ? lost / total : 0;
  const g = goals(s, kg);
  const mealDays = streak(d.meals.map((m) => m.day), today);
  const weighDays = streak(d.weights.map((w) => w.day), today);

  // Tage mit vollständigem Tagebuch (mind. 2 Mahlzeiten), außer heute
  const byDay = new Map<string, Meal[]>();
  for (const m of d.meals) if (m.day < today) byDay.set(m.day, [...(byDay.get(m.day) ?? []), m]);
  const fullDays = [...byDay.values()].filter((l) => l.length >= 2).map(sum);
  const inBudget = fullDays.filter((n) => n.kcal <= g.kcal + 50).length;
  const proteinDays = fullDays.filter((n) => n.protein >= g.protein).length;
  const wGoal = waterGoal(kg);
  const waterDays = d.daily.filter((x) => x.water_ml >= wGoal).length;
  const stepDays = d.daily.filter((x) => (x.steps ?? 0) >= STEPS_GOAL).length;
  const bp = d.measurements.filter((m) => m.kind === "bp").length;
  const body = d.measurements.filter((m) => m.kind === "waist").length;

  const list: Achievement[] = [];
  const add = (id: string, icon: string, title: string, text: string, value: number, target: number) =>
    list.push({ id, icon, title, text, done: value >= target, progress: [Math.min(value, target), target] });

  add("start", "🌱", "Losgelegt", "Erste Mahlzeit eingetragen", d.meals.length, 1);
  add("serie7", "🔥", "Eine Woche dran", "7 Tage am Stück Essen eingetragen", mealDays.best, 7);
  add("serie30", "🔥", "Ein Monat dran", "30 Tage am Stück Essen eingetragen", mealDays.best, 30);
  add("serie100", "💯", "Hundert Tage", "100 Tage am Stück Essen eingetragen", mealDays.best, 100);
  add("waage7", "⚖️", "Waagen-Woche", "7 Tage am Stück gewogen", weighDays.best, 7);
  for (const k of [1, 3, 5, 10, 15, 20]) if (k <= Math.max(total, 1) + 0.01) add(`minus${k}`, "📉", `−${k} kg`, `${k} kg weniger als am Start`, Math.max(0, Math.round(lost * 10) / 10), k);
  for (const p of [25, 50, 75]) add(`ziel${p}`, "🎯", `${p} % geschafft`, `${p} % des Weges zum Wunschgewicht`, Math.max(0, Math.round(share * 100)), p);
  add("ziel100", "🏆", "Ziel erreicht!", "Wunschgewicht erreicht", Math.max(0, Math.round(share * 100)), 100);
  add("budget7", "✅", "Im Rahmen", "7 Tage im Kalorienziel geblieben", inBudget, 7);
  add("eiweiss7", "💪", "Eiweiß-Profi", "7 Tage das Eiweißziel erreicht", proteinDays, 7);
  add("wasser7", "💧", "Gut getrunken", "7 Tage das Wasserziel erreicht", waterDays, 7);
  add("schritte10", "👟", "Viel unterwegs", `10 Tage über ${STEPS_GOAL.toLocaleString("de-DE")} Schritte`, stepDays, 10);
  add("blutdruck", "❤️", "Herz im Blick", "Blutdruck 14-mal gemessen", bp, 14);
  add("massband", "📏", "Maßband-Fan", "Taille 4-mal gemessen", body, 4);
  add("labor", "🧪", "Gut informiert", "Laborwerte eingetragen", d.labs.length, 1);
  return list;
}
